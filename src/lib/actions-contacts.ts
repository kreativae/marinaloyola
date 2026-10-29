"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  channels,
  contacts,
  contactTags,
  deals,
  eventTypes,
  interactions,
  payments,
  pipelineStages,
  tags,
  users,
  whatsappMessages,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ensureChannel } from "@/lib/channels";
import { contactWhere } from "@/lib/contacts-query";
import { addInteraction, attachTag, ensureTag, localeFor } from "@/lib/crm";
import { COUNTRIES, countryName, countryOfTz, defaultTzOf, isValidTz } from "@/lib/timezones";
import { CONTACT_STATUS, SOURCES } from "@/lib/utils";

type ContactStatus = (typeof contacts.$inferSelect)["status"];
type Source = (typeof contacts.$inferSelect)["source"];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (s: string) => s || null;
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const cleanIds = (ids: number[]) => ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000);

function refresh(id?: number) {
  revalidatePath("/admin/contactos");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/crm/${id}`);
}

/** Outro contacto já usa este email ou telefone? */
async function findDuplicate(email: string | null, phone: string | null, exceptId?: number) {
  const conds = [];
  if (email) conds.push(sql`lower(${contacts.email}) = ${email.toLowerCase()}`);
  const d = digits(phone);
  if (d.length >= 9) {
    conds.push(sql`right(regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g'), 9) = ${d.slice(-9)}`);
  }
  if (!conds.length) return null;
  const [dup] = await db
    .select({ id: contacts.id, name: contacts.name })
    .from(contacts)
    .where(
      exceptId
        ? and(sql`(${sql.join(conds, sql` or `)})`, sql`${contacts.id} <> ${exceptId}`)
        : sql.join(conds, sql` or `)
    )
    .limit(1);
  return dup ?? null;
}

/** "" = sem canal, "new" = criar com o nome em newChannel, ou o id de um canal existente. */
async function readChannel(fd: FormData): Promise<number | null> {
  const raw = str(fd, "channelId");
  if (raw === "new") {
    const name = str(fd, "newChannel");
    return name ? ensureChannel(name) : null;
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [found] = await db.select({ id: channels.id }).from(channels).where(eq(channels.id, id)).limit(1);
  return found?.id ?? null;
}

/** País e fuso do formulário; vazios → deduzidos do telefone. */
function readLocale(fd: FormData) {
  const country = str(fd, "country").toUpperCase();
  const tz = str(fd, "timezone");
  if (isValidTz(tz)) return { timezone: tz, country: /^[A-Z]{2}$/.test(country) ? country : countryOfTz(tz) };
  if (/^[A-Z]{2}$/.test(country)) return { country, timezone: defaultTzOf(country) ?? null };
  return localeFor(str(fd, "phone")) ?? { country: null, timezone: null };
}

function readContactForm(fd: FormData) {
  const sourceRaw = str(fd, "source");
  return {
    ...readLocale(fd),
    name: str(fd, "name"),
    referredBy: orNull(str(fd, "referredBy")),
    email: orNull(str(fd, "email").toLowerCase()),
    phone: orNull(str(fd, "phone")),
    location: orNull(str(fd, "location")),
    notes: orNull(str(fd, "notes")),
    source: (sourceRaw in SOURCES ? sourceRaw : "manual") as Source,
  };
}

export type FormResult = { ok: boolean; error?: string; id?: number };

export async function createContactAction(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const data = readContactForm(fd);
  if (!data.name) return { ok: false, error: "Indique o nome." };
  if (!data.email && !data.phone) return { ok: false, error: "Indique pelo menos um email ou telefone." };
  const dup = await findDuplicate(data.email, data.phone);
  if (dup) return { ok: false, error: `Já existe um contacto com estes dados: ${dup.name}.`, id: dup.id };
  if (str(fd, "channelId") === "new" && !str(fd, "newChannel")) return { ok: false, error: "Escreva o nome do novo canal." };
  const [row] = await db
    .insert(contacts)
    .values({ ...data, channelId: await readChannel(fd) })
    .returning({ id: contacts.id });
  await addInteraction(row.id, "system", "Contacto criado manualmente.");
  refresh();
  return { ok: true, id: row.id };
}

export async function updateContactAction(
  id: number,
  _prev: FormResult | null,
  fd: FormData
): Promise<FormResult> {
  await requireAdmin();
  const data = readContactForm(fd);
  const statusRaw = str(fd, "status");
  if (!data.name) return { ok: false, error: "Indique o nome." };
  if (!data.email && !data.phone) return { ok: false, error: "Indique pelo menos um email ou telefone." };
  const dup = await findDuplicate(data.email, data.phone, id);
  if (dup) return { ok: false, error: `Email ou telefone já usado por: ${dup.name}.`, id: dup.id };
  if (str(fd, "channelId") === "new" && !str(fd, "newChannel")) return { ok: false, error: "Escreva o nome do novo canal." };
  await db
    .update(contacts)
    .set({
      ...data,
      channelId: await readChannel(fd),
      ...(statusRaw in CONTACT_STATUS ? { status: statusRaw as ContactStatus } : {}),
    })
    .where(eq(contacts.id, id));
  await addInteraction(id, "system", "Dados do contacto actualizados.");
  refresh(id);
  return { ok: true, id };
}

/** Contactos com pagamentos não são apagados: o histórico financeiro tem de ficar intacto. */
async function withPayments(ids: number[]) {
  const rows = await db
    .selectDistinct({ id: payments.contactId })
    .from(payments)
    .where(inArray(payments.contactId, ids));
  return new Set(rows.map((r) => r.id));
}

export async function deleteContactAction(id: number): Promise<{ error?: string }> {
  await requireAdmin();
  if ((await withPayments([id])).size) {
    return { error: "Este contacto tem pagamentos registados e não pode ser apagado. Marque-o como Inativo." };
  }
  await db.delete(contacts).where(eq(contacts.id, id));
  refresh();
  redirect("/admin/contactos?apagados=1");
}

/* ------------------------------ EM MASSA -------------------------------- */

export async function bulkSetStatus(ids: number[], status: string) {
  await requireAdmin();
  const list = cleanIds(ids);
  if (!list.length || !(status in CONTACT_STATUS)) return;
  await db.update(contacts).set({ status: status as ContactStatus }).where(inArray(contacts.id, list));
  for (const id of list) {
    await addInteraction(id, "system", `Estado alterado para "${CONTACT_STATUS[status].label}" (acção em massa).`);
  }
  refresh();
}

export async function bulkAddTag(ids: number[], tagName: string) {
  await requireAdmin();
  const list = cleanIds(ids);
  const name = tagName.trim();
  if (!list.length || !name) return;
  const tagId = await ensureTag(name);
  for (const id of list) await attachTag(id, tagId);
  refresh();
}

export async function bulkSetChannel(ids: number[], channelId: number | null) {
  await requireAdmin();
  const list = cleanIds(ids);
  if (!list.length) return;
  await db.update(contacts).set({ channelId }).where(inArray(contacts.id, list));
  refresh();
}

/* ------------------------------- CANAIS --------------------------------- */

export async function createChannel(name: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (!name.trim()) return { error: "Indique o nome." };
  await ensureChannel(name);
  refresh();
  revalidatePath("/admin/config");
  return {};
}

export async function updateChannel(id: number, name: string, color: string): Promise<{ error?: string }> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) return { error: "Indique o nome." };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { error: "Cor inválida." };
  const [clash] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(sql`lower(${channels.name}) = ${clean.toLowerCase()}`, sql`${channels.id} <> ${id}`))
    .limit(1);
  if (clash) return { error: "Já existe um canal com esse nome." };
  await db.update(channels).set({ name: clean, color }).where(eq(channels.id, id));
  refresh();
  revalidatePath("/admin/config");
  return {};
}

/** Apagar um canal não apaga os contactos: ficam sem canal. */
export async function deleteChannel(id: number) {
  await requireAdmin();
  await db.delete(channels).where(eq(channels.id, id));
  refresh();
  revalidatePath("/admin/config");
}

export async function bulkRemoveTag(ids: number[], tagId: number) {
  await requireAdmin();
  const list = cleanIds(ids);
  if (!list.length || !tagId) return;
  await db
    .delete(contactTags)
    .where(and(inArray(contactTags.contactId, list), eq(contactTags.tagId, tagId)));
  refresh();
}

export async function bulkDelete(ids: number[]): Promise<{ deleted: number; blocked: number }> {
  await requireAdmin();
  const list = cleanIds(ids);
  if (!list.length) return { deleted: 0, blocked: 0 };
  const blocked = await withPayments(list);
  const deletable = list.filter((id) => !blocked.has(id));
  if (deletable.length) await db.delete(contacts).where(inArray(contacts.id, deletable));
  refresh();
  return { deleted: deletable.length, blocked: blocked.size };
}

/* ------------------------------ IMPORTAR -------------------------------- */

const HEADER_ALIASES: Record<string, keyof ReturnType<typeof readContactForm> | "tags" | "channel"> = {
  nome: "name", name: "name",
  email: "email", "e-mail": "email",
  telefone: "phone", telemovel: "phone", "telemóvel": "phone", phone: "phone", whatsapp: "phone", celular: "phone",
  localizacao: "location", "localização": "location", cidade: "location", location: "location",
  origem: "source", source: "source",
  notas: "notes", notes: "notes", observacoes: "notes", "observações": "notes",
  tags: "tags", etiquetas: "tags",
  pais: "country", "país": "country", country: "country",
  fuso: "timezone", "fuso horário": "timezone", timezone: "timezone",
  canal: "channel", rede: "channel", channel: "channel", "canal de origem": "channel", networking: "channel",
  "indicado por": "referredBy", indicacao: "referredBy", "indicação": "referredBy", referral: "referredBy",
};

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const SOURCE_BY_LABEL = Object.fromEntries(
  Object.entries(SOURCES).flatMap(([k, label]) => [[k, k], [label.toLowerCase(), k]])
);

/** País pode vir como código (BR) ou nome (Brasil). */
function importLocale(countryRaw: string, tzRaw: string, phone: string | null) {
  const byName = COUNTRIES.find(
    (c) => c.code === countryRaw.toUpperCase() || countryName(c.code).toLowerCase() === countryRaw.toLowerCase()
  );
  if (isValidTz(tzRaw)) return { timezone: tzRaw, country: byName?.code ?? countryOfTz(tzRaw) };
  if (byName) return { country: byName.code, timezone: byName.tz };
  return localeFor(phone) ?? {};
}

export async function importContactsAction(_prev: ImportResult | null, fd: FormData): Promise<ImportResult> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha um ficheiro CSV." };
  if (file.size > 5_000_000) return { ok: false, error: "Ficheiro demasiado grande (máx. 5 MB)." };
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { ok: false, error: "O ficheiro não tem linhas de dados." };

  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!header.includes("name")) {
    return { ok: false, error: "Falta a coluna “Nome” no cabeçalho." };
  }

  let created = 0;
  let skipped = 0;
  const problems: string[] = [];
  for (const [i, r] of rows.slice(1).entries()) {
    const get = (k: string) => (r[header.indexOf(k as never)] ?? "").trim();
    const name = get("name");
    const email = get("email").toLowerCase() || null;
    const phone = get("phone") || null;
    if (!name || (!email && !phone)) {
      skipped++;
      if (problems.length < 5) problems.push(`Linha ${i + 2}: falta nome ou contacto.`);
      continue;
    }
    if (await findDuplicate(email, phone)) {
      skipped++;
      continue;
    }
    const [row] = await db
      .insert(contacts)
      .values({
        name,
        email,
        phone,
        location: get("location") || null,
        notes: get("notes") || null,
        referredBy: get("referredBy") || null,
        ...importLocale(get("country"), get("timezone"), phone),
        channelId: get("channel") ? await ensureChannel(get("channel")) : null,
        source: (SOURCE_BY_LABEL[get("source").toLowerCase()] ?? "manual") as Source,
      })
      .returning({ id: contacts.id });
    for (const t of get("tags").split(/[,|]/).map((s) => s.trim()).filter(Boolean)) {
      await attachTag(row.id, await ensureTag(t));
    }
    await addInteraction(row.id, "system", `Importado de ${file.name}.`);
    created++;
  }
  refresh();
  return { ok: true, created, skipped, problems };
}

export type ImportResult = {
  ok: boolean;
  error?: string;
  created?: number;
  skipped?: number;
  problems?: string[];
};

/* --------------------------- RESUMO (PAINEL) ---------------------------- */

export type ContactSummary = {
  contact: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    source: string;
    status: string;
    notes: string | null;
    createdAt: string;
    channel: { name: string; color: string } | null;
    referredBy: string | null;
    country: string | null;
    timezone: string | null;
  };
  tags: { name: string; color: string }[];
  stats: { spent: number; pending: number; openDeals: number; openDealsValue: number; sessions: number };
  nextAppointment: { name: string; startAt: string; meetingUrl: string | null } | null;
  appointments: { id: number; name: string; startAt: string; status: string }[];
  payments: { id: number; product: string; amount: number; status: string; createdAt: string }[];
  deals: { id: number; title: string; stage: string; value: number }[];
  timeline: { id: number; type: string; content: string; createdAt: string }[];
  whatsapp: { last: { body: string; direction: string; createdAt: string } | null; unread: number };
  courses: { id: number; title: string; done: number; total: number }[];
};

export async function getContactSummary(id: number): Promise<ContactSummary | null> {
  await requireAdmin();
  const [c] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!c) return null;
  const [channel] = c.channelId
    ? await db.select({ name: channels.name, color: channels.color }).from(channels).where(eq(channels.id, c.channelId)).limit(1)
    : [];

  const [tagRows, payRows, apptRows, dealRows, timeline, [lastWa], [{ unread }], [account]] = await Promise.all([
    db
      .select({ name: tags.name, color: tags.color })
      .from(contactTags)
      .innerJoin(tags, eq(tags.id, contactTags.tagId))
      .where(eq(contactTags.contactId, id)),
    db.select().from(payments).where(eq(payments.contactId, id)).orderBy(desc(payments.createdAt)),
    db
      .select({ a: appointments, name: eventTypes.name })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(eq(appointments.contactId, id))
      .orderBy(desc(appointments.startAt)),
    db
      .select({ d: deals, stage: pipelineStages.name })
      .from(deals)
      .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .where(eq(deals.contactId, id))
      .orderBy(desc(deals.updatedAt)),
    db.select().from(interactions).where(eq(interactions.contactId, id)).orderBy(desc(interactions.createdAt)).limit(6),
    db.select().from(whatsappMessages).where(eq(whatsappMessages.contactId, id)).orderBy(desc(whatsappMessages.createdAt)).limit(1),
    db
      .select({ unread: count() })
      .from(whatsappMessages)
      .where(and(eq(whatsappMessages.contactId, id), eq(whatsappMessages.direction, "in"), isNull(whatsappMessages.readAt))),
    c.email ? db.select({ id: users.id }).from(users).where(eq(users.email, c.email)).limit(1) : Promise.resolve([]),
  ]);

  // Cursos da aluna com a mesma conta de email
  let courseRows: ContactSummary["courses"] = [];
  if (account) {
    const res = await db.execute(sql`
      SELECT c.id, c.title,
        (SELECT count(*)::int FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS total,
        (SELECT count(*)::int FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id JOIN modules m ON m.id = l.module_id
           WHERE m.course_id = c.id AND lp.user_id = ${account.id}) AS done
      FROM enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ${account.id}
      ORDER BY e.created_at DESC`);
    courseRows = (res.rows as { id: number; title: string; total: number; done: number }[]).map((r) => ({
      id: r.id,
      title: r.title,
      total: r.total,
      done: r.done,
    }));
  }

  const paid = payRows.filter((p) => p.status === "confirmed" || p.status === "completed");
  const now = Date.now();
  const next = [...apptRows]
    .reverse()
    .find(({ a }) => a.startAt.getTime() > now && a.status !== "cancelled");
  const openDeals = dealRows.filter(({ stage }) => !/conclu|ganho|perdido|fechado/i.test(stage));

  return {
    contact: {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      location: c.location,
      source: c.source,
      status: c.status,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      channel: channel ?? null,
      referredBy: c.referredBy,
      country: c.country,
      timezone: c.timezone,
    },
    tags: tagRows,
    stats: {
      spent: paid.reduce((s, p) => s + Number(p.amount), 0),
      pending: payRows.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0),
      openDeals: openDeals.length,
      openDealsValue: openDeals.reduce((s, { d }) => s + Number(d.value), 0),
      sessions: apptRows.filter(({ a }) => a.status !== "cancelled").length,
    },
    nextAppointment: next
      ? { name: next.name ?? "Sessão", startAt: next.a.startAt.toISOString(), meetingUrl: next.a.meetingUrl }
      : null,
    appointments: apptRows.slice(0, 3).map(({ a, name }) => ({
      id: a.id,
      name: name ?? "Sessão",
      startAt: a.startAt.toISOString(),
      status: a.status,
    })),
    payments: payRows.slice(0, 4).map((p) => ({
      id: p.id,
      product: p.product,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    deals: dealRows.slice(0, 3).map(({ d, stage }) => ({ id: d.id, title: d.title, stage, value: Number(d.value) })),
    timeline: timeline.map((i) => ({ id: i.id, type: i.type, content: i.content, createdAt: i.createdAt.toISOString() })),
    whatsapp: {
      last: lastWa ? { body: lastWa.body, direction: lastWa.direction, createdAt: lastWa.createdAt.toISOString() } : null,
      unread,
    },
    courses: courseRows,
  };
}

/* --------------------------- PESQUISA RÁPIDA ---------------------------- */

/** Pesquisa para a paleta de comandos (⌘K): nome, email, telefone ou cidade. */
export async function quickSearchContacts(q: string) {
  await requireAdmin();
  if (q.trim().length < 2) return [];
  const rows = await db
    .select({ id: contacts.id, name: contacts.name, email: contacts.email, phone: contacts.phone, country: contacts.country })
    .from(contacts)
    .where(contactWhere({ q }))
    .orderBy(contacts.name)
    .limit(6);
  return rows;
}
