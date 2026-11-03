"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents, appointments, contacts, eventTypes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isRepeatFreq, MAX_OCCURRENCES, occurrences, parseEmails, REMIND_OPTIONS, type RepeatRule } from "@/lib/agenda-def";
import { addInteraction } from "@/lib/crm";
import { bookingRescheduleEmail, getEmailConfig, sendEmail } from "@/lib/email";
import { cityOf, countryOfTz, dualDateTime, flag, fmtTime, HOME_TZ } from "@/lib/timezones";
import { sendWhatsappToContact } from "@/lib/whatsapp";

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
    await addInteraction(a.contactId, "system", `Cliente avisada do reagendamento por ${sent.join(" e ")}.`);
  }
  return sent.length
    ? { ok: true, message: `${a.name.split(/\s+/)[0]} avisada por ${sent.join(" e ")}.` }
    : {
        ok: false,
        message: emailPreview
          ? "Não foi enviado: configure o Resend (email) ou o WhatsApp em Configurações."
          : "Não foi possível avisar a cliente.",
      };
}

/* --------------------------- EVENTOS INTERNOS --------------------------- */

export type AgendaEventResult = { ok: boolean; error?: string; warning?: string; id?: number; created?: number };

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
  };

  const [current] = id ? await db.select().from(agendaEvents).where(eq(agendaEvents.id, id)).limit(1) : [];
  if (id && !current) return { ok: false, error: "Evento não encontrado." };
  const dur = endAt.getTime() - startAt.getTime();
  let savedId = id;
  let created = 1;

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
  }

  // Aviso (sem impedir) quando já há sessões de clientes nesse período
  const saved = savedId
    ? await db
        .select({ startAt: agendaEvents.startAt, endAt: agendaEvents.endAt, seriesId: agendaEvents.seriesId })
        .from(agendaEvents)
        .where(eq(agendaEvents.id, savedId))
        .limit(1)
    : [];
  const series = saved[0]?.seriesId
    ? await db
        .select({ startAt: agendaEvents.startAt, endAt: agendaEvents.endAt })
        .from(agendaEvents)
        .where(and(eq(agendaEvents.seriesId, saved[0].seriesId), gte(agendaEvents.startAt, saved[0].startAt)))
        .orderBy(asc(agendaEvents.startAt))
    : saved;
  const first = series[0]?.startAt ?? startAt;
  const last = series.at(-1)?.endAt ?? endAt;
  const nearby = await db
    .select({ name: appointments.name, startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(and(ne(appointments.status, "cancelled"), lt(appointments.startAt, last), gt(appointments.endAt, first)));
  const clashes = nearby.filter((c) => series.some((o) => c.startAt < o.endAt && c.endAt > o.startAt));
  refreshAgenda();
  return {
    ok: true,
    id: savedId ?? undefined,
    created,
    warning: clashes.length
      ? `Atenção: já tem ${clashes.length === 1 ? "1 sessão" : `${clashes.length} sessões`} marcada${clashes.length === 1 ? "" : "s"} ${created > 1 ? "nestes horários" : "neste período"} (${[...new Set(clashes.map((c) => c.name))].slice(0, 6).join(", ")}).`
      : undefined,
  };
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
