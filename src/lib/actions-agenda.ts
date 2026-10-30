"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents, appointments, contacts, eventTypes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
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
  try {
    await sendEmail(
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
    sent.push("email");
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
    : { ok: false, message: "Não foi possível avisar a cliente." };
}

/* --------------------------- EVENTOS INTERNOS --------------------------- */

export type AgendaEventResult = { ok: boolean; error?: string; warning?: string; id?: number };

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

/** Cria ou edita um compromisso. Com "bloquear marcações", esse período deixa de aparecer como livre em /agendar. */
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

  const color = /^#[0-9a-f]{6}$/i.test(str("color")) ? str("color") : "#0ea5e9";
  const values = {
    title: title.slice(0, 200),
    notes: str("notes").slice(0, 4000) || null,
    location: str("location").slice(0, 300) || null,
    startAt,
    endAt,
    allDay,
    blocksBooking: fd.get("blocksBooking") === "1",
    color,
  };
  let savedId = id;
  if (id) await db.update(agendaEvents).set(values).where(eq(agendaEvents.id, id));
  else [{ id: savedId }] = await db.insert(agendaEvents).values(values).returning({ id: agendaEvents.id });

  // Aviso (sem impedir) quando já há sessões de clientes nesse período
  const clashes = await db
    .select({ name: appointments.name })
    .from(appointments)
    .where(and(ne(appointments.status, "cancelled"), lt(appointments.startAt, endAt), gt(appointments.endAt, startAt)));
  refreshAgenda();
  return {
    ok: true,
    id: savedId ?? undefined,
    warning: clashes.length
      ? `Atenção: já tem ${clashes.length === 1 ? "1 sessão" : `${clashes.length} sessões`} marcada${clashes.length === 1 ? "" : "s"} neste período (${clashes.map((c) => c.name).join(", ")}).`
      : undefined,
  };
}

export async function deleteAgendaEvent(id: number) {
  await requireAdmin();
  await db.delete(agendaEvents).where(eq(agendaEvents.id, id));
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
  await db.update(agendaEvents).set({ startAt, endAt }).where(eq(agendaEvents.id, id));
  refreshAgenda();
  return { ok: true };
}
