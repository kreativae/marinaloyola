"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents, appointments, contacts, eventTypes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isRepeatFreq, MAX_OCCURRENCES, occurrences, parseEmails, REMIND_OPTIONS, repeatLabel, repeatRRule, type RepeatRule } from "@/lib/agenda-def";
import { addInteraction } from "@/lib/crm";
import { bookingRescheduleEmail, eventInviteEmail, getEmailConfig, sendEmail } from "@/lib/email";
import { cityOf, countryOfTz, dualDateTime, flag, fmtTime, HOME_TZ } from "@/lib/timezones";
import { sendWhatsappToContact } from "@/lib/whatsapp";
import { createZoomMeeting, getZoomConfig, hasApiCredentials, rescheduleZoomMeeting } from "@/lib/zoom";

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/**
 * Move uma sessão para outro dia/hora mantendo a duração (arrastar e soltar na agenda).
 * `day` é AAAA-MM-DD e `startMin` os minutos desde a meia-noite, ambos na hora de Lisboa (fuso do servidor).
 */
export async function rescheduleAppointment(
  id: number,
  day: string,
  startMin: number
): Promise<{
  ok: boolean;
  error?: string;
  from?: { day: string; startMin: number };
  label?: string;
  clientLabel?: string | null;
  warning?: string;
}> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(startMin) || startMin < 0 || startMin >= 1440) {
    return { ok: false, error: "Horário inválido." };
  }
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!appt) return { ok: false, error: "Sessão não encontrada." };

  const [y, m, d] = day.split("-").map(Number);
  const startAt = new Date(y, m - 1, d, 0, startMin);
  const endAt = new Date(startAt.getTime() + (appt.endAt.getTime() - appt.startAt.getTime()));
  if (startAt.getTime() === appt.startAt.getTime()) return { ok: true };

  const [clash] = await db
    .select({ name: appointments.name })
    .from(appointments)
    .where(
      and(
        ne(appointments.id, id),
        ne(appointments.status, "cancelled"),
        lt(appointments.startAt, endAt),
        gt(appointments.endAt, startAt)
      )
    )
    .limit(1);
  if (clash) return { ok: false, error: `Esse horário já tem uma sessão (${clash.name}).` };

  await db.update(appointments).set({ startAt, endAt }).where(eq(appointments.id, id));
  if (appt.contactId) {
    await addInteraction(appt.contactId, "booking", `Sessão reagendada de ${fmt(appt.startAt)} para ${fmt(startAt)}.`);
  }
  // A sessão já mudou: uma falha no Zoom fica registada, não desfaz o reagendamento
  const zoom = await rescheduleZoomMeeting(appt.meetingUrl, startAt, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
  if (zoom.status === "failed") {
    console.error("[zoom] reagendamento falhou:", zoom.error);
    if (appt.contactId) await addInteraction(appt.contactId, "system", `Não foi possível atualizar a hora no Zoom: ${zoom.error}`);
  }
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  const old = appt.startAt;
  return {
    ok: true,
    from: {
      day: `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, "0")}-${String(old.getDate()).padStart(2, "0")}`,
      startMin: old.getHours() * 60 + old.getMinutes(),
    },
    label: fmt(startAt),
    warning: zoom.status === "failed" ? "A hora no Zoom não foi atualizada; o link continua a funcionar." : undefined,
    // Hora para a cliente, quando está noutro fuso
    clientLabel:
      appt.timezone !== HOME_TZ && fmtTime(startAt, appt.timezone) !== fmtTime(startAt, HOME_TZ)
        ? `${flag(countryOfTz(appt.timezone))} ${fmtTime(startAt, appt.timezone)} em ${cityOf(appt.timezone)}`.trim()
        : null,
  };
}

/** Avisa a cliente do novo horário por email (e WhatsApp, se houver telefone e a Evolution estiver ligada). */
export async function notifyReschedule(id: number): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const [row] = await db
    .select({ a: appointments, eventName: eventTypes.name, durationMin: eventTypes.durationMin })
    .from(appointments)
    .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
    .where(eq(appointments.id, id))
    .limit(1);
  if (!row) return { ok: false, message: "Sessão não encontrada." };
  const { a } = row;
  const sent: string[] = [];
  const mail = await getEmailConfig();
  let emailPreview = false;
  try {
    const result = await sendEmail(
      bookingRescheduleEmail(
        {
          name: a.name,
          email: a.email,
          phone: a.phone,
          notes: a.notes,
          eventName: row.eventName ?? "Sessão",
          durationMin: Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000),
          startAt: a.startAt,
          endAt: a.endAt,
          meetingUrl: a.meetingUrl,
          id: a.id,
          timezone: a.timezone,
        },
        mail.notifyEmail
      )
    );
    if (result === "sent") sent.push("email");
    else emailPreview = true;
  } catch (e) {
    console.error("[email] reagendamento falhou:", e);
  }
  if (a.phone && a.contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, a.contactId)).limit(1);
    if (contact) {
      try {
        await sendWhatsappToContact(
          { ...contact, phone: a.phone },
          `Olá ${a.name.split(/\s+/)[0]}! A sua ${row.eventName ?? "sessão"} foi reagendada para ${dualDateTime(a.startAt, a.timezone)}.${
            a.meetingUrl ? `\n\nLink da sessão: ${a.meetingUrl}` : ""
          }\n\nAté breve,\nMarina Loyola`
        );
        sent.push("WhatsApp");
      } catch {
        /* WhatsApp não configurado: fica só o email */
      }
    }
  }
  if (a.contactId && sent.length) {
    await addInteraction(a.contactId, "system", `Aviso de reagendamento enviado por ${sent.join(" e ")}.`);
  }
  return sent.length
    ? { ok: true, message: `Aviso enviado a ${a.name.split(/\s+/)[0]} por ${sent.join(" e ")}.` }
    : {
        ok: false,
        message: emailPreview
          ? "Não foi enviado: configure o Resend (email) ou o WhatsApp em Configurações."
          : "Não foi possível enviar o aviso.",
      };
}

/* --------------------------- EVENTOS INTERNOS --------------------------- */

export type AgendaEventResult = { ok: boolean; error?: string; warning?: string; notice?: string; id?: number; created?: number };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Hora de Lisboa (fuso do servidor)
const at = (day: string, time = "00:00") => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
};

function refreshAgenda() {
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/agendar");
}

/** Regista o evento na ficha e envia o convite; devolve um aviso quando o email não saiu. */
async function tellContact(
  contact: typeof contacts.$inferSelect,
  before: typeof agendaEvents.$inferSelect | undefined,
  ev: { title: string; startAt: Date; endAt: Date; allDay: boolean; location: string | null; emailContact: boolean },
  id: number | null,
  created: number,
  series: { id: string; rule: RepeatRule } | null
) {
  const first = contact.name.split(/\s+/)[0];
  const linkedNow = before?.contactId !== contact.id;
  if (linkedNow) {
    await addInteraction(contact.id, "system", `Evento "${ev.title}" vinculado para ${fmt(ev.startAt)}${created > 1 ? ` (${created} ocorrências)` : ""}.`);
  }
  if (!ev.emailContact) return undefined;
  const changed =
    linkedNow ||
    !before?.emailContact ||
    before.title !== ev.title ||
    before.location !== ev.location ||
    before.startAt.getTime() !== ev.startAt.getTime() ||
    before.endAt.getTime() !== ev.endAt.getTime();
  if (!changed) return undefined;
  try {
    const mail = await getEmailConfig();
    const result = await sendEmail(
      eventInviteEmail(
        {
          ...ev,
          uid: series ? `serie-${series.id}` : `evento-${id}`,
          name: contact.name,
          email: contact.email!,
          timezone: contact.timezone,
          updated: !linkedNow && Boolean(before?.emailContact),
          repeat: series ? repeatLabel(series.rule, ev.startAt) : null,
          rrule: series ? repeatRRule(series.rule, created) : null,
        },
        mail.notifyEmail
      )
    );
    if (result === "sent") {
      await addInteraction(contact.id, "system", `Convite do evento "${ev.title}" enviado para ${contact.email}.`);
      return undefined;
    }
    await addInteraction(contact.id, "system", `Convite do evento "${ev.title}" não enviado: o Resend não está configurado.`);
    return `O email para ${first} não foi enviado: o Resend não está configurado.`;
  } catch (e) {
    console.error("[email] convite do evento falhou:", e);
    await addInteraction(contact.id, "system", `Falha ao enviar o convite do evento "${ev.title}" para ${contact.email}.`);
    return `O email para ${first} falhou. Avise por outro canal.`;
  }
}

/**
 * Cria ou edita um compromisso. Com "bloquear marcações", esse período deixa de aparecer como livre em /agendar.
 * Com repetição, cada ocorrência fica guardada como um evento da mesma série. Ao editar uma ocorrência,
 * scope="one" muda só essa; scope="future" refaz essa e as seguintes com as novas regras.
 */
export async function saveAgendaEvent(id: number | null, _prev: AgendaEventResult | null, fd: FormData): Promise<AgendaEventResult> {
  await requireAdmin();
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const title = str("title");
  const day = str("date");
  const endDay = str("endDate") || day;
  const allDay = fd.get("allDay") === "1";
  if (!title) return { ok: false, error: "Dê um título ao evento." };
  if (!DAY_RE.test(day) || !DAY_RE.test(endDay)) return { ok: false, error: "Escolha a data." };

  let startAt: Date;
  let endAt: Date;
  if (allDay) {
    startAt = at(day);
    endAt = at(endDay);
    endAt.setDate(endAt.getDate() + 1);
  } else {
    const start = str("start");
    const end = str("end");
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { ok: false, error: "Indique a hora de início e de fim." };
    startAt = at(day, start);
    endAt = at(endDay, end);
  }
  if (endAt <= startAt) return { ok: false, error: "O fim tem de ser depois do início." };
  if (endAt.getTime() - startAt.getTime() > 62 * 86_400_000) return { ok: false, error: "Um evento pode durar no máximo 2 meses." };

  // Repetição
  const freq = str("repeat");
  let rule: RepeatRule | null = null;
  if (isRepeatFreq(freq)) {
    const ends = str("repeatEnd");
    const until = ends === "until" ? str("repeatUntil") : "";
    const count = ends === "count" ? Math.round(Number(str("repeatCount"))) : NaN;
    if (ends === "until" && (!DAY_RE.test(until) || until < day)) return { ok: false, error: "A data de fim da repetição tem de ser depois do primeiro dia." };
    if (ends === "count" && !(count >= 2 && count <= MAX_OCCURRENCES)) return { ok: false, error: `O número de vezes tem de estar entre 2 e ${MAX_OCCURRENCES}.` };
    rule = { freq, until: until || null, count: Number.isFinite(count) ? count : null };
  }

  // Lembrete por email
  const remindRaw = str("remindMin");
  const remindMin = remindRaw && REMIND_OPTIONS.some((o) => o.value === remindRaw) ? Number(remindRaw) : null;
  const extra = parseEmails(str("remindTo"));
  if (remindMin !== null && extra.invalid.length) return { ok: false, error: `Email inválido: ${extra.invalid[0]}` };

  // Contacto ligado e email para o contacto
  const contactId = fd.get("linkContact") === "1" ? Number(str("contactId")) || null : null;
  if (fd.get("linkContact") === "1" && !contactId) return { ok: false, error: "Escolha o contacto a vincular." };
  const [contact] = contactId ? await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1) : [];
  if (contactId && !contact) return { ok: false, error: "Contacto não encontrado." };
  const emailContact = Boolean(contact) && fd.get("emailContact") === "1";
  if (emailContact && !contact.email) return { ok: false, error: "Este contacto não tem email. Adicione-o na ficha ou desligue o envio." };

  const color = /^#[0-9a-f]{6}$/i.test(str("color")) ? str("color") : "#0ea5e9";
  const values = {
    title: title.slice(0, 200),
    notes: str("notes").slice(0, 4000) || null,
    location: str("location").slice(0, 300) || null,
    allDay,
    blocksBooking: fd.get("blocksBooking") === "1",
    color,
    remindMin,
    remindTo: remindMin !== null && extra.emails.length ? extra.emails.join(", ") : null,
    remindedAt: null,
    contactId,
    emailContact,
  };

  const [current] = id ? await db.select().from(agendaEvents).where(eq(agendaEvents.id, id)).limit(1) : [];
  if (id && !current) return { ok: false, error: "Evento não encontrado." };
  const dur = endAt.getTime() - startAt.getTime();
  let savedId = id;
  let created = 1;
  let series: { id: string; rule: RepeatRule } | null = null;

  if (current?.seriesId && str("scope") !== "future") {
    // Só esta ocorrência: a série mantém-se
    await db.update(agendaEvents).set({ ...values, startAt, endAt }).where(eq(agendaEvents.id, current.id));
  } else {
    if (current?.seriesId) {
      // Esta e as seguintes são refeitas; as anteriores ficam como estavam, a terminar na véspera
      await db.delete(agendaEvents).where(and(eq(agendaEvents.seriesId, current.seriesId), gt(agendaEvents.startAt, current.startAt)));
      const prevDay = new Date(current.startAt.getFullYear(), current.startAt.getMonth(), current.startAt.getDate() - 1);
      const earlier = await db
        .select({ id: agendaEvents.id, repeat: agendaEvents.repeat })
        .from(agendaEvents)
        .where(and(eq(agendaEvents.seriesId, current.seriesId), lt(agendaEvents.startAt, current.startAt)))
        .limit(1);
      if (earlier[0]?.repeat) {
        const until = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, "0")}-${String(prevDay.getDate()).padStart(2, "0")}`;
        await db
          .update(agendaEvents)
          .set({ repeat: { ...earlier[0].repeat, until, count: null } })
          .where(and(eq(agendaEvents.seriesId, current.seriesId), lt(agendaEvents.startAt, current.startAt)));
      }
    }
    const starts = rule ? occurrences(startAt, rule) : [startAt];
    const seriesId = rule && starts.length > 1 ? crypto.randomUUID() : null;
    const rows = starts.map((s) => ({
      ...values,
      startAt: s,
      endAt: new Date(s.getTime() + dur),
      seriesId,
      repeat: seriesId ? rule : null,
    }));
    if (current) {
      await db.update(agendaEvents).set(rows[0]).where(eq(agendaEvents.id, current.id));
      if (rows.length > 1) await db.insert(agendaEvents).values(rows.slice(1));
    } else {
      [{ id: savedId }] = await db.insert(agendaEvents).values(rows).returning({ id: agendaEvents.id });
    }
    created = rows.length;
    if (seriesId && rule) series = { id: seriesId, rule };
  }

  // Histórico do contacto e convite (ao editar, só se algo que o contacto vê mudou)
  const notice = contact ? await tellContact(contact, current, { ...values, startAt, endAt }, savedId, created, series) : undefined;

  // Aviso (sem impedir) quando já há sessões de clientes nesse período
  const saved = savedId
    ? await db
        .select({ startAt: agendaEvents.startAt, endAt: agendaEvents.endAt, seriesId: agendaEvents.seriesId })
        .from(agendaEvents)
        .where(eq(agendaEvents.id, savedId))
        .limit(1)
    : [];
  const occurrencesSaved = saved[0]?.seriesId
    ? await db
        .select({ startAt: agendaEvents.startAt, endAt: agendaEvents.endAt })
        .from(agendaEvents)
        .where(and(eq(agendaEvents.seriesId, saved[0].seriesId), gte(agendaEvents.startAt, saved[0].startAt)))
        .orderBy(asc(agendaEvents.startAt))
    : saved;
  const first = occurrencesSaved[0]?.startAt ?? startAt;
  const last = occurrencesSaved.at(-1)?.endAt ?? endAt;
  const nearby = await db
    .select({ name: appointments.name, startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(and(ne(appointments.status, "cancelled"), lt(appointments.startAt, last), gt(appointments.endAt, first)));
  const clashes = nearby.filter((c) => occurrencesSaved.some((o) => c.startAt < o.endAt && c.endAt > o.startAt));
  refreshAgenda();
  return {
    ok: true,
    id: savedId ?? undefined,
    created,
    notice,
    warning: clashes.length
      ? `Atenção: já tem ${clashes.length === 1 ? "1 sessão" : `${clashes.length} sessões`} marcada${clashes.length === 1 ? "" : "s"} ${created > 1 ? "nestes horários" : "neste período"} (${[...new Set(clashes.map((c) => c.name))].slice(0, 6).join(", ")}).`
      : undefined,
  };
}

/**
 * Botão "Gerar link Zoom" do formulário de evento. Com a API do Zoom ligada cria uma reunião nova
 * (sem hora fixa quando o evento se repete); senão usa a sala fixa de Configurações → Zoom.
 */
export async function createEventZoomLink(input: {
  title: string;
  date: string;
  start?: string;
  end?: string;
  allDay: boolean;
  recurring: boolean;
}): Promise<{ ok: true; url: string; note?: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!DAY_RE.test(input.date)) return { ok: false, error: "Escolha primeiro o dia do evento." };
  const c = await getZoomConfig();
  const fixed = c.fixedUrl ? { ok: true as const, url: c.fixedUrl, note: "Sala fixa do Zoom (Configurações → Zoom)." } : null;
  if (c.mode !== "api" || !hasApiCredentials(c)) {
    return fixed ?? { ok: false, error: "Ligue o Zoom em Configurações → Zoom (API ou sala fixa) para gerar links." };
  }
  const start = input.allDay || !TIME_RE.test(input.start ?? "") ? at(input.date, "09:00") : at(input.date, input.start);
  const endMin = TIME_RE.test(input.end ?? "") ? Number(input.end!.slice(0, 2)) * 60 + Number(input.end!.slice(3, 5)) : 0;
  const startMin = start.getHours() * 60 + start.getMinutes();
  const duration = input.allDay ? 60 : Math.max(15, Math.min(24 * 60, endMin - startMin || 60));
  try {
    const url = await createZoomMeeting(c, input.title.trim() || "Reunião — Marina Loyola", start, duration, input.recurring);
    return { ok: true, url, note: input.recurring ? "Reunião Zoom criada, com o mesmo link para todas as repetições." : "Reunião Zoom criada." };
  } catch (e) {
    console.error("[zoom] link de evento falhou:", e);
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    return fixed ? { ...fixed, note: `A API do Zoom falhou (${msg}); foi usada a sala fixa.` } : { ok: false, error: `O Zoom recusou: ${msg}` };
  }
}

/** Apaga um compromisso; numa série, só esta ocorrência, esta e as seguintes, ou todas. */
export async function deleteAgendaEvent(id: number, scope: "one" | "future" | "all" = "one") {
  await requireAdmin();
  const [ev] = await db.select().from(agendaEvents).where(eq(agendaEvents.id, id)).limit(1);
  if (!ev) return;
  if (ev.seriesId && scope === "all") await db.delete(agendaEvents).where(eq(agendaEvents.seriesId, ev.seriesId));
  else if (ev.seriesId && scope === "future")
    await db.delete(agendaEvents).where(and(eq(agendaEvents.seriesId, ev.seriesId), gte(agendaEvents.startAt, ev.startAt)));
  else await db.delete(agendaEvents).where(eq(agendaEvents.id, id));
  refreshAgenda();
}

/** Arrastar e soltar um compromisso no calendário (mantém a duração). */
export async function moveAgendaEvent(id: number, day: string, startMin: number): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!DAY_RE.test(day) || !Number.isInteger(startMin) || startMin < 0 || startMin >= 1440) return { ok: false, error: "Horário inválido." };
  const [ev] = await db.select().from(agendaEvents).where(eq(agendaEvents.id, id)).limit(1);
  if (!ev) return { ok: false, error: "Evento não encontrado." };
  const startAt = at(day);
  startAt.setMinutes(ev.allDay ? 0 : startMin);
  const endAt = new Date(startAt.getTime() + (ev.endAt.getTime() - ev.startAt.getTime()));
  await db.update(agendaEvents).set({ startAt, endAt, remindedAt: null }).where(eq(agendaEvents.id, id));
  refreshAgenda();
  return { ok: true };
}
