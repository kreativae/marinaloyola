"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availability, eventTypes, users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { addInteraction, findOrCreateContact, tagContact } from "@/lib/crm";
import { getBusy } from "@/lib/calendar";
import { bookingConfirmationEmail, bookingNotificationEmail, getEmailConfig, sendEmail } from "@/lib/email";
import { getSettings, isOn } from "@/lib/settings";
import { dayIn, dualDateTime, fmtTime, HOME_TZ, isValidTz, zonedToUtc } from "@/lib/timezones";
import { fillTemplate } from "@/lib/utils";
import { meetingLinkFor } from "@/lib/zoom";
import { sendWhatsappToContact } from "@/lib/whatsapp";

/* -------------------------------- AUTH ---------------------------------- */

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?erro=1");
  }
  await createSession(user.id);
  redirect(user.role === "student" ? "/aluno" : "/admin");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/* ------------------------------ LEADS (SITE) ---------------------------- */

export async function submitLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const tag = String(formData.get("tag") ?? "Lead Site");
  const redirectTo = String(formData.get("redirectTo") ?? "/contato?ok=1");
  if (!name || !email) redirect(redirectTo.split("?")[0] + "?erro=1");

  const { contact, created } = await findOrCreateContact({
    name,
    email,
    phone,
    source: "site",
  });
  await tagContact(contact.id, tag, "#800080");
  await addInteraction(
    contact.id,
    "note",
    [subject ? `Assunto: ${subject}` : null, message || "Subscreveu a newsletter."]
      .filter(Boolean)
      .join(" — ")
  );
  if (created) revalidatePath("/admin/crm");
  redirect(redirectTo);
}

/* ---------------------------- AGENDAMENTO ------------------------------- */

export type SlotInfo = { time: string };

export async function getBookingRules() {
  const m = await getSettings(["booking_notice_hours", "booking_buffer_min", "booking_window_days"]);
  const num = (v: string, fallback: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
  };
  return {
    noticeHours: num(m.booking_notice_hours, 1, 168),
    bufferMin: num(m.booking_buffer_min, 15, 120),
    windowDays: Math.max(1, num(m.booking_window_days, 21, 120)),
  };
}

/** Horários livres (instantes) de um dia de Lisboa — o calendário de trabalho da Marina. */
async function slotsForLisbonDay(et: typeof eventTypes.$inferSelect, dateStr: string): Promise<Date[]> {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const dow = day.getDay();
  const rules = await getBookingRules();
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + rules.windowDays - 1);
  if (day > lastDay) return [];

  const avails = await db
    .select()
    .from(availability)
    .where(and(eq(availability.dayOfWeek, dow), eq(availability.active, true)));
  if (!avails.length) return [];

  const nextDay = new Date(y, m - 1, d + 1);
  const [dayAppts, busy] = await Promise.all([
    db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(
        and(
          lt(appointments.startAt, nextDay),
          gte(appointments.endAt, day),
          ne(appointments.status, "cancelled")
        )
      ),
    getBusy(),
  ]);
  // Agendamentos e eventos ocupados do Google Calendar, como intervalos absolutos
  const blocked = [
    ...dayAppts.map((a) => ({ start: new Date(a.startAt), end: new Date(a.endAt) })),
    ...busy.filter((b) => b.start < nextDay && b.end > day),
  ];

  const dur = et.durationMin;
  const step = dur + rules.bufferMin;
  const earliest = now.getTime() + rules.noticeHours * 3_600_000;

  const slots: Date[] = [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  // Cada dia divide-se em blocos à volta do intervalo (almoço): depois da pausa,
  // os horários recomeçam exactamente no fim do intervalo
  const blocks = avails.flatMap((a) =>
    a.breakStart && a.breakEnd
      ? [
          [toMin(a.startTime), toMin(a.breakStart)],
          [toMin(a.breakEnd), toMin(a.endTime)],
        ]
      : [[toMin(a.startTime), toMin(a.endTime)]]
  );
  for (const [blockStart, blockEnd] of blocks) {
    for (let t = blockStart; t + dur <= blockEnd; t += step) {
      const start = new Date(y, m - 1, d, 0, t);
      const end = new Date(start.getTime() + dur * 60_000);
      if (start.getTime() < earliest) continue;
      if (blocked.some((b) => start < b.end && end > b.start)) continue;
      slots.push(start);
    }
  }
  return slots;
}

export type Slot = { iso: string; time: string; lisbon: string };

/**
 * Horários livres de um dia no fuso da cliente. Um dia no Brasil pode atravessar dois dias
 * de Lisboa, por isso juntam-se os horários dos dias de Lisboa que se sobrepõem.
 */
export async function getAvailableSlots(eventTypeId: number, dateStr: string, timezone = HOME_TZ): Promise<Slot[]> {
  const [et] = await db.select().from(eventTypes).where(eq(eventTypes.id, eventTypeId)).limit(1);
  if (!et || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const tz = isValidTz(timezone) ? timezone : HOME_TZ;
  const [y, m, d] = dateStr.split("-").map(Number);
  const from = zonedToUtc(y, m, d, 0, 0, 0, tz);
  const to = zonedToUtc(y, m, d + 1, 0, 0, 0, tz);
  const lisbonDays = [...new Set([dayIn(from, HOME_TZ), dayIn(new Date(to.getTime() - 1), HOME_TZ)])];
  const all = (await Promise.all(lisbonDays.map((ld) => slotsForLisbonDay(et, ld)))).flat();
  return all
    .filter((s) => s >= from && s < to)
    .sort((a, b) => a.getTime() - b.getTime())
    .map((s) => ({ iso: s.toISOString(), time: fmtTime(s, tz), lisbon: fmtTime(s, HOME_TZ) }));
}

export async function createBooking(data: {
  eventTypeId: number;
  date: string; // dia no fuso da cliente
  slot: string; // instante ISO devolvido por getAvailableSlots
  timezone: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [et] = await db.select().from(eventTypes).where(eq(eventTypes.id, data.eventTypeId)).limit(1);
  if (!et || !data.name.trim() || !data.email.trim()) {
    return { ok: false, error: "Dados inválidos." };
  }
  const tz = isValidTz(data.timezone) ? data.timezone : HOME_TZ;
  const startAt = new Date(data.slot);
  if (Number.isNaN(startAt.getTime())) return { ok: false, error: "Horário inválido." };
  const free = await getAvailableSlots(et.id, data.date, tz);
  if (!free.some((s) => s.iso === startAt.toISOString())) {
    return { ok: false, error: "Este horário já não está disponível. Escolha outro." };
  }
  const endAt = new Date(startAt.getTime() + et.durationMin * 60000);
  const meeting = await meetingLinkFor(`${et.name} — ${data.name.trim()}`, startAt, et.durationMin);
  const meetingUrl = meeting.url;

  const { contact } = await findOrCreateContact({
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    source: "site",
    timezone: tz,
  });
  await tagContact(contact.id, "Agendamento", "#a855f7");
  const [created] = await db.insert(appointments).values({
    eventTypeId: et.id,
    contactId: contact.id,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone ?? null,
    notes: data.notes ?? null,
    startAt,
    endAt,
    meetingUrl,
    timezone: tz,
  }).returning({ id: appointments.id });
  await addInteraction(
    contact.id,
    "booking",
    `Agendou "${et.name}" para ${dualDateTime(startAt, tz)}.${
      meeting.source === "api" ? " Reunião Zoom criada automaticamente." : ""
    }`
  );
  if (meeting.error) {
    await addInteraction(contact.id, "system", `Não foi possível criar a reunião Zoom: ${meeting.error}`);
  }

  // O agendamento já está guardado: uma falha de email fica registada, não anula a marcação.
  const mail = await getEmailConfig();
  const booking = {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone,
    notes: data.notes,
    eventName: et.name,
    durationMin: et.durationMin,
    startAt,
    endAt,
    meetingUrl,
    id: created.id,
    timezone: tz,
  };
  const [toClient, toMarina] = await Promise.allSettled([
    mail.bookingClient ? sendEmail(bookingConfirmationEmail(booking, mail.notifyEmail)) : null,
    mail.bookingAdmin ? sendEmail(bookingNotificationEmail(booking, mail.notifyEmail)) : null,
  ]);
  if (toClient.status === "fulfilled" && toClient.value) {
    await addInteraction(contact.id, "system", `Email de confirmação enviado para ${booking.email}.`);
  } else if (toClient.status === "rejected") {
    console.error("[email] confirmação falhou:", toClient.reason);
    await addInteraction(contact.id, "system", `Falha ao enviar email de confirmação para ${booking.email}.`);
  }
  if (toMarina.status === "rejected") console.error("[email] notificação falhou:", toMarina.reason);

  const wa = await getSettings(["wa_booking_confirm", "wa_booking_template"]);
  if (data.phone?.trim() && isOn(wa.wa_booking_confirm)) {
    const when = dualDateTime(startAt, tz);
    try {
      await sendWhatsappToContact(
        { ...contact, phone: data.phone },
        fillTemplate(wa.wa_booking_template, {
          nome: booking.name.split(/\s+/)[0],
          sessao: et.name,
          data: when,
          link: meetingUrl ? `Link da sessão: ${meetingUrl}` : "O link da videochamada será enviado antes da sessão.",
        })
      );
      await addInteraction(contact.id, "system", "Confirmação enviada por WhatsApp.");
    } catch (e) {
      console.error("[whatsapp] confirmação falhou:", e);
    }
  }

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/crm");
  return { ok: true };
}
