import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents, contacts } from "@/db/schema";
import { ALL_DAY_REMIND_HOUR } from "@/lib/agenda-def";
import { eventReminderEmail, getEmailConfig, sendEmail } from "@/lib/email";

/**
 * Lembretes por email dos eventos da Agenda. Corre a cada minuto (ver src/instrumentation.ts).
 * Cada lembrete é marcado como enviado antes de sair, por isso nunca vai duas vezes,
 * e um lembrete atrasado mais de 2 horas (servidor desligado) já não é enviado.
 */

function whenLabel(start: Date, allDay: boolean, now = new Date()) {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (allDay) return days <= 0 ? "Hoje" : days === 1 ? "Amanhã" : `Daqui a ${days} dias`;
  const min = Math.round((start.getTime() - now.getTime()) / 60_000);
  if (min <= 1) return "Agora";
  if (min < 60) return `Daqui a ${min} min`;
  if (days === 0) return `Hoje às ${start.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return `Amanhã às ${start.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
  return `Daqui a ${days} dias`;
}

export async function sendDueReminders() {
  // Hora do lembrete = início (ou 9h do dia, nos eventos de dia inteiro) menos a antecedência
  const due = sql`(${agendaEvents.startAt} + (case when ${agendaEvents.allDay} then ${ALL_DAY_REMIND_HOUR} else 0 end) * interval '1 hour' - ${agendaEvents.remindMin} * interval '1 minute')`;
  const claimed = await db
    .update(agendaEvents)
    .set({ remindedAt: new Date() })
    .where(
      and(
        isNotNull(agendaEvents.remindMin),
        isNull(agendaEvents.remindedAt),
        sql`${due} <= (now() at time zone 'utc')`,
        sql`${due} > (now() at time zone 'utc') - interval '2 hours'`
      )
    )
    .returning();
  if (!claimed.length) return 0;

  const mail = await getEmailConfig();
  for (const ev of claimed) {
    const [contact] =
      ev.emailContact && ev.contactId
        ? await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, ev.contactId)).limit(1)
        : [];
    const to = [mail.notifyEmail, ...(ev.remindTo ?? "").split(/,\s*/), contact?.email ?? ""].filter(Boolean);
    const data = { ...ev, when: whenLabel(ev.startAt, ev.allDay) };
    for (const addr of new Set(to)) {
      try {
        await sendEmail(eventReminderEmail(data, addr, mail.appUrl, addr === mail.notifyEmail));
      } catch (e) {
        console.error(`[lembrete] "${ev.title}" para ${addr} falhou:`, e);
      }
    }
  }
  return claimed.length;
}
