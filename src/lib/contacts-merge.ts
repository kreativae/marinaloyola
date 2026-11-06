import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agendaEvents,
  appointments,
  contacts,
  deals,
  formSubmissions,
  interactions,
  payments,
  users,
  whatsappMessages,
  type Contact,
} from "@/db/schema";
import {
  cleanEmail,
  fullNameKey,
  nameIsPhone,
  phoneTail,
  samePhone,
  type DuplicateReason,
} from "@/lib/contacts-def";
import { readRaw, saveSettings } from "@/lib/settings";

const digitsOf = sql`regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g')`;

/** Contactos com este email ou telefone, do mais antigo para o mais recente. */
export async function matchContacts(email: string | null | undefined, phone: string | null | undefined) {
  const mail = cleanEmail(email);
  const tail = phoneTail(phone);
  const conds = [];
  if (mail) conds.push(sql`lower(trim(${contacts.email})) = ${mail}`);
  if (tail) conds.push(sql`right(${digitsOf}, 8) = ${tail}`);
  if (!conds.length) return [];
  const rows = await db
    .select()
    .from(contacts)
    .where(sql.join(conds, sql` or `))
    .orderBy(asc(contacts.createdAt), asc(contacts.id));
  return rows.filter((c) => (mail && cleanEmail(c.email) === mail) || samePhone(c.phone, phone));
}

const STATUS_RANK: Record<Contact["status"], number> = {
  lost: 0,
  inactive: 1,
  lead: 2,
  qualified: 3,
  negotiating: 4,
  client: 5,
};

/**
 * Junta `dropId` em `keepId`: o histórico, as conversas, os negócios, os pagamentos, os agendamentos,
 * os eventos, as notas, as etiquetas e as respostas passam para o contacto que fica, e o outro é apagado.
 */
export async function mergeContacts(keepId: number, dropId: number, opts: { auto?: boolean } = {}): Promise<Contact | null> {
  if (keepId === dropId) return null;
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(contacts)
      .where(inArray(contacts.id, [keepId, dropId]))
      .orderBy(asc(contacts.id))
      .for("update");
    const keep = rows.find((c) => c.id === keepId);
    const drop = rows.find((c) => c.id === dropId);
    if (!keep || !drop) return null;

    // Com dois emails, fica o que tem conta de acesso: é por ele que a conta se liga ao contacto
    let email = keep.email ?? drop.email;
    if (keep.email && drop.email && cleanEmail(keep.email) !== cleanEmail(drop.email)) {
      const accounts = await tx
        .select({ email: users.email })
        .from(users)
        .where(sql`lower(${users.email}) in (${cleanEmail(keep.email)}, ${cleanEmail(drop.email)})`);
      const has = (v: string) => accounts.some((a) => cleanEmail(a.email) === cleanEmail(v));
      if (has(drop.email) && !has(keep.email)) email = drop.email;
    }
    // O mesmo número escrito de duas formas: fica a versão mais completa
    let phone = keep.phone ?? drop.phone;
    if (keep.phone && drop.phone && samePhone(keep.phone, drop.phone)) {
      const size = (v: string) => v.replace(/\D/g, "").length;
      phone = size(drop.phone) > size(keep.phone) ? drop.phone : keep.phone;
    }
    const lost = [
      drop.email && cleanEmail(drop.email) !== cleanEmail(email) ? drop.email : null,
      keep.email && cleanEmail(keep.email) !== cleanEmail(email) ? keep.email : null,
      drop.phone && !samePhone(drop.phone, phone) ? drop.phone : null,
    ].filter(Boolean);
    const older = drop.createdAt < keep.createdAt ? drop : keep;

    const move = { contactId: keepId };
    await tx.update(interactions).set(move).where(eq(interactions.contactId, dropId));
    await tx.update(whatsappMessages).set(move).where(eq(whatsappMessages.contactId, dropId));
    await tx.update(deals).set(move).where(eq(deals.contactId, dropId));
    await tx.update(payments).set(move).where(eq(payments.contactId, dropId));
    await tx.update(appointments).set(move).where(eq(appointments.contactId, dropId));
    await tx.update(agendaEvents).set(move).where(eq(agendaEvents.contactId, dropId));
    await tx.update(formSubmissions).set(move).where(eq(formSubmissions.contactId, dropId));
    await tx.execute(
      sql`insert into contact_tags (contact_id, tag_id) select ${keepId}, tag_id from contact_tags where contact_id = ${dropId} on conflict do nothing`
    );
    await tx.execute(
      sql`insert into note_contacts (note_id, contact_id) select note_id, ${keepId} from note_contacts where contact_id = ${dropId} on conflict do nothing`
    );
    await tx.delete(contacts).where(eq(contacts.id, dropId));

    const [merged] = await tx
      .update(contacts)
      .set({
        name: nameIsPhone(keep.name) && !nameIsPhone(drop.name) ? drop.name : keep.name,
        email,
        phone,
        location: keep.location ?? drop.location,
        country: keep.country ?? drop.country,
        timezone: keep.timezone ?? drop.timezone,
        channelId: keep.channelId ?? drop.channelId,
        referredBy: keep.referredBy ?? drop.referredBy,
        notes: [...new Set([keep.notes, drop.notes].filter(Boolean))].join("\n\n") || null,
        status: STATUS_RANK[drop.status] > STATUS_RANK[keep.status] ? drop.status : keep.status,
        source: older.source,
        createdAt: older.createdAt,
      })
      .where(eq(contacts.id, keepId))
      .returning();
    const ids = [drop.email, drop.phone].filter(Boolean).join(" · ");
    await tx.insert(interactions).values({
      contactId: keepId,
      type: "system",
      content: [
        `Contacto “${drop.name}”${ids ? ` (${ids})` : ""} mesclado ${opts.auto ? "automaticamente" : "manualmente"}.`,
        lost.length ? `Dados que não ficaram na ficha: ${lost.join(", ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
    return merged;
  });
}

/* ------------------------- POSSÍVEIS DUPLICADOS ------------------------- */

export type DuplicateMember = Pick<Contact, "id" | "name" | "email" | "phone" | "source" | "status" | "createdAt">;
export type DuplicateGroup = { key: string; reasons: DuplicateReason[]; members: DuplicateMember[] };

const DISMISSED = "contacts_not_duplicates";

async function dismissedGroups() {
  const raw = (await readRaw([DISMISSED]))[DISMISSED];
  try {
    const list = JSON.parse(raw ?? "[]");
    return new Set<string>(Array.isArray(list) ? list : []);
  } catch {
    return new Set<string>();
  }
}

/** "Não é duplicado": o grupo só volta a aparecer se entrar outro contacto nele. */
export async function dismissDuplicateGroup(key: string) {
  const list = await dismissedGroups();
  list.add(key);
  await saveSettings({ [DISMISSED]: JSON.stringify([...list].slice(-2000)) });
}

export async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  const [rows, dismissed] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        source: contacts.source,
        status: contacts.status,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .orderBy(asc(contacts.createdAt), asc(contacts.id)),
    dismissedGroups(),
  ]);

  const parent = new Map(rows.map((c) => [c.id, c.id]));
  const root = (id: number): number => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const r = root(p);
    parent.set(id, r);
    return r;
  };
  const links: { id: number; reason: DuplicateReason }[] = [];
  const link = (a: DuplicateMember, b: DuplicateMember, reason: DuplicateReason) => {
    parent.set(root(b.id), root(a.id));
    links.push({ id: a.id, reason });
  };
  const bucket = (keyOf: (c: DuplicateMember) => string | null) => {
    const map = new Map<string, DuplicateMember[]>();
    for (const c of rows) {
      const k = keyOf(c);
      if (k) map.set(k, [...(map.get(k) ?? []), c]);
    }
    return [...map.values()].filter((list) => list.length > 1);
  };

  for (const list of bucket((c) => cleanEmail(c.email) || null)) {
    for (const c of list.slice(1)) link(list[0], c, "email");
  }
  for (const list of bucket((c) => phoneTail(c.phone))) {
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => samePhone(a.phone, b.phone) && link(a, b, "phone")));
  }
  for (const list of bucket((c) => fullNameKey(c.name))) {
    for (const c of list.slice(1)) link(list[0], c, "name");
  }

  const groups = new Map<number, DuplicateMember[]>();
  for (const c of rows) {
    const r = root(c.id);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([r, members]) => ({
      key: members.map((m) => m.id).sort((a, b) => a - b).join("-"),
      reasons: [...new Set(links.filter((l) => root(l.id) === r).map((l) => l.reason))],
      members,
    }))
    .filter((g) => !dismissed.has(g.key));
}

