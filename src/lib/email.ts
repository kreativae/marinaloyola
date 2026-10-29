import fs from "node:fs/promises";
import path from "node:path";
import { getSettings, isOn } from "@/lib/settings";
import { cityOf, HOME_TZ, isValidTz } from "@/lib/timezones";

/**
 * Envio de emails via Resend (https://resend.com).
 * Chave e remetente em Configurações → Email (ou RESEND_API_KEY / EMAIL_FROM).
 * Sem chave (desenvolvimento), o email é guardado em .emails/ para pré-visualização.
 */

export type Attachment = { filename: string; content: string; contentType: string };

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
};

export async function getEmailConfig() {
  const m = await getSettings([
    "resend_api_key",
    "email_from",
    "notify_email",
    "contact_email",
    "email_booking_client",
    "email_booking_admin",
  ]);
  return {
    apiKey: m.resend_api_key,
    from: m.email_from,
    notifyEmail: m.notify_email || m.contact_email,
    bookingClient: isOn(m.email_booking_client),
    bookingAdmin: isOn(m.email_booking_admin),
  };
}

/** Devolve "preview" quando não há chave e o email foi guardado em .emails/. */
export async function sendEmail(email: Email): Promise<"sent" | "preview"> {
  const { apiKey: key, from } = await getEmailConfig();
  if (!key) {
    const dir = path.join(process.cwd(), ".emails");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${email.to.replace(/[^a-z0-9.@-]/gi, "_")}.html`);
    await fs.writeFile(
      file,
      `<!-- Para: ${email.to} | Assunto: ${email.subject} | Anexos: ${(email.attachments ?? []).map((a) => a.filename).join(", ") || "—"} -->\n${email.html}`
    );
    console.log(`[email] sem API key do Resend — "${email.subject}" para ${email.to} guardado em ${file}`);
    return "preview";
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      reply_to: email.replyTo,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
        content_type: a.contentType,
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return "sent";
}

/* ------------------------------ TEMPLATES ------------------------------- */

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fmtLongDate = (d: Date, tz = HOME_TZ) =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
const fmtTime = (d: Date, tz = HOME_TZ) =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);

/** Data e hora no fuso da cliente, com a referência de Lisboa quando é diferente. */
function clientWhen(b: BookingEmailData) {
  const tz = isValidTz(b.timezone) ? b.timezone : HOME_TZ;
  const date = fmtLongDate(b.startAt, tz);
  const time = fmtTime(b.startAt, tz);
  const lisbon = fmtTime(b.startAt);
  const sameDay = fmtLongDate(b.startAt) === date;
  const hour =
    tz === HOME_TZ
      ? `${time} (hora de Lisboa)`
      : lisbon === time && sameDay
        ? `${time} (${cityOf(tz)} · igual a Lisboa)`
        : `${time} (${cityOf(tz)}) · ${sameDay ? "" : `${fmtLongDate(b.startAt)}, `}${lisbon} em Lisboa`;
  return { date, time, hour };
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#3f3f46">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:20px">
<tr><td style="padding:32px 32px 8px">
<div style="font-family:Georgia,serif;font-style:italic;font-size:24px;color:#18181b">Marina Loyola</div>
<div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#800080;margin-top:4px">Design &amp; Mentoria</div>
</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.6">${body}</td></tr>
</table>
<div style="font-size:11px;color:#a1a1aa;margin-top:16px">marinaloyola.com</div>
</td></tr></table></body></html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 0;color:#71717a;font-size:13px;width:110px">${label}</td><td style="padding:6px 0;color:#18181b">${value}</td></tr>`;

export type BookingEmailData = {
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  eventName: string;
  durationMin: number;
  startAt: Date;
  endAt: Date;
  meetingUrl: string | null;
  /** id do agendamento: UID estável no convite, para o reagendamento actualizar o mesmo evento */
  id?: number;
  /** fuso da cliente (IANA) */
  timezone?: string | null;
};

export function bookingConfirmationEmail(b: BookingEmailData, replyTo: string): Email {
  const { date, time, hour } = clientWhen(b);
  const first = b.name.trim().split(/\s+/)[0];
  const html = layout(
    "Agendamento confirmado",
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:28px;color:#18181b;margin:0 0 16px">Está confirmado, ${escapeHtml(first)}.</h1>
<p style="margin:0 0 20px">Obrigada por marcar a sua sessão. Aqui estão os detalhes:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
${row("Sessão", escapeHtml(b.eventName))}
${row("Data", date)}
${row("Hora", escapeHtml(hour))}
${row("Duração", `${b.durationMin} minutos`)}
</table>
${
  b.meetingUrl
    ? `<a href="${escapeHtml(b.meetingUrl)}" style="display:inline-block;background:#800080;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;font-size:14px">Entrar na sessão</a>`
    : `<p style="margin:0;background:#f4f4f5;border-radius:12px;padding:16px;color:#3f3f46">O link da videochamada será enviado antes da sessão.</p>`
}
<p style="margin:24px 0 0;font-size:13px;color:#71717a">O convite de calendário vai em anexo. Precisa de reagendar? Basta responder a este email.</p>`
  );
  const text = `Está confirmado, ${first}.

Sessão: ${b.eventName}
Data: ${date}
Hora: ${hour}
Duração: ${b.durationMin} minutos
${b.meetingUrl ? `Link: ${b.meetingUrl}` : "O link da videochamada será enviado antes da sessão."}

Precisa de reagendar? Basta responder a este email.
— Marina Loyola`;
  return {
    to: b.email,
    subject: `Confirmado: ${b.eventName} — ${date}, ${time}`,
    html,
    text,
    replyTo,
    attachments: [{ filename: "sessao.ics", content: bookingIcs(b, replyTo), contentType: "text/calendar; method=REQUEST" }],
  };
}

export function bookingRescheduleEmail(b: BookingEmailData, replyTo: string): Email {
  const { date, time, hour } = clientWhen(b);
  const first = b.name.trim().split(/\s+/)[0];
  const html = layout(
    "Sessão reagendada",
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:28px;color:#18181b;margin:0 0 16px">Novo horário, ${escapeHtml(first)}.</h1>
<p style="margin:0 0 20px">A sua sessão foi reagendada. Estes são os novos detalhes:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
${row("Sessão", escapeHtml(b.eventName))}
${row("Data", date)}
${row("Hora", escapeHtml(hour))}
${row("Duração", `${b.durationMin} minutos`)}
</table>
${
  b.meetingUrl
    ? `<a href="${escapeHtml(b.meetingUrl)}" style="display:inline-block;background:#800080;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;font-size:14px">Entrar na sessão</a>`
    : ""
}
<p style="margin:24px 0 0;font-size:13px;color:#71717a">O convite actualizado vai em anexo. Se o novo horário não der jeito, basta responder a este email.</p>`
  );
  const text = `Novo horário, ${first}.

Sessão: ${b.eventName}
Data: ${date}
Hora: ${hour}
${b.meetingUrl ? `Link: ${b.meetingUrl}` : ""}

Se o novo horário não der jeito, basta responder a este email.
— Marina Loyola`;
  return {
    to: b.email,
    subject: `Reagendado: ${b.eventName} — ${date}, ${time}`,
    html,
    text,
    replyTo,
    attachments: [{ filename: "sessao.ics", content: bookingIcs(b, replyTo), contentType: "text/calendar; method=REQUEST" }],
  };
}

export function bookingNotificationEmail(b: BookingEmailData, to: string): Email {
  const date = fmtLongDate(b.startAt);
  const time = fmtTime(b.startAt);
  const html = layout(
    "Novo agendamento",
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:26px;color:#18181b;margin:0 0 16px">Novo agendamento</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${row("Nome", escapeHtml(b.name))}
${row("Email", escapeHtml(b.email))}
${b.phone ? row("Telefone", escapeHtml(b.phone)) : ""}
${row("Sessão", escapeHtml(b.eventName))}
${row("Quando", `${date}, ${time} (Lisboa)`)}
${b.timezone && b.timezone !== HOME_TZ ? row("Para a cliente", escapeHtml(`${fmtLongDate(b.startAt, b.timezone)}, ${fmtTime(b.startAt, b.timezone)} (${cityOf(b.timezone)})`)) : ""}
${b.meetingUrl ? row("Link", `<a href="${escapeHtml(b.meetingUrl)}" style="color:#800080">${escapeHtml(b.meetingUrl)}</a>`) : ""}
</table>
${b.notes ? `<div style="background:#f4f4f5;border-radius:12px;padding:16px;white-space:pre-wrap;color:#3f3f46">${escapeHtml(b.notes)}</div>` : ""}`
  );
  const text = `Novo agendamento: ${b.name} <${b.email}>${b.phone ? ` · ${b.phone}` : ""}
${b.eventName} — ${date}, ${time}
${b.meetingUrl ?? ""}
${b.notes ?? ""}`;
  return { to, subject: `Novo agendamento: ${b.name} — ${date}, ${time}`, html, text, replyTo: b.email };
}

function bookingIcs(b: BookingEmailData, organizer: string) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marina Loyola//Agendamento//PT",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${b.id ? `agendamento-${b.id}` : `${stamp(b.startAt)}-${b.email}`}@marinaloyola.com`,
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startAt)}`,
    `DTEND:${stamp(b.endAt)}`,
    `SUMMARY:${esc(`${b.eventName} — Marina Loyola`)}`,
    ...(b.meetingUrl
      ? [`DESCRIPTION:${esc(`Link da sessão: ${b.meetingUrl}`)}`, `LOCATION:${esc(b.meetingUrl)}`]
      : []),
    `ORGANIZER;CN=Marina Loyola:mailto:${organizer}`,
    `ATTENDEE;CN=${esc(b.name)};RSVP=TRUE:mailto:${b.email}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function testEmail(to: string): Email {
  const html = layout(
    "Email de teste",
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:26px;color:#18181b;margin:0 0 16px">Está a funcionar.</h1>
<p style="margin:0">Este é um email de teste enviado a partir de Configurações → Email. As confirmações de agendamento vão ser enviadas com este remetente.</p>`
  );
  return {
    to,
    subject: "Email de teste — Marina Loyola",
    html,
    text: "Está a funcionar. Este é um email de teste enviado a partir de Configurações → Email.",
  };
}
