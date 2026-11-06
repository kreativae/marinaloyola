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
    "email_lead_admin",
    "email_sale_admin",
    "app_url",
  ]);
  return {
    apiKey: m.resend_api_key,
    from: m.email_from,
    notifyEmail: m.notify_email || m.contact_email,
    bookingClient: isOn(m.email_booking_client),
    bookingAdmin: isOn(m.email_booking_admin),
    leadAdmin: isOn(m.email_lead_admin),
    saleAdmin: isOn(m.email_sale_admin),
    appUrl: m.app_url.replace(/\/+$/, ""),
  };
}

/**
 * Aviso para a equipa (novo lead, venda Hotmart…). Nunca lança: uma falha de email
 * não pode estragar o formulário nem o webhook que o chamou.
 */
export async function notifyTeam(
  flag: "leadAdmin" | "saleAdmin",
  build: (to: string, appUrl: string) => Email
) {
  try {
    const mail = await getEmailConfig();
    if (!mail[flag] || !mail.notifyEmail) return;
    await sendEmail(build(mail.notifyEmail, mail.appUrl));
  } catch (e) {
    console.error(`[email] aviso à equipa (${flag}) falhou:`, e);
  }
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
function clientWhen(b: Pick<BookingEmailData, "startAt" | "timezone">) {
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
${b.timezone && b.timezone !== HOME_TZ ? row("No fuso de quem marcou", escapeHtml(`${fmtLongDate(b.startAt, b.timezone)}, ${fmtTime(b.startAt, b.timezone)} (${cityOf(b.timezone)})`)) : ""}
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

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#800080;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;font-size:13px">${label}</a>`;

export type LeadEmailData = {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string;
  message?: string;
  tag: string;
  contactId: number;
  isNew: boolean;
};

export function leadNotificationEmail(l: LeadEmailData, to: string, appUrl: string): Email {
  const newsletter = !l.message && !l.subject;
  const title = newsletter ? "Nova subscrição da newsletter" : "Nova mensagem do site";
  const link = `${appUrl}/admin/crm/${l.contactId}`;
  const html = layout(
    title,
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:26px;color:#18181b;margin:0 0 16px">${title}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${row("Nome", escapeHtml(l.name))}
${row("Email", escapeHtml(l.email))}
${l.phone ? row("Telefone", escapeHtml(l.phone)) : ""}
${row("Origem", escapeHtml(l.tag))}
${row("Contacto", l.isNew ? "Novo no CRM" : "Já existia no CRM")}
${l.subject ? row("Assunto", escapeHtml(l.subject)) : ""}
</table>
${l.message ? `<div style="background:#f4f4f5;border-radius:12px;padding:16px;white-space:pre-wrap;color:#3f3f46;margin-bottom:20px">${escapeHtml(l.message)}</div>` : ""}
${button(link, "Abrir no CRM")}
<p style="margin:20px 0 0;font-size:13px;color:#71717a">Pode responder diretamente a este email para falar com ${escapeHtml(l.name.split(/\s+/)[0])}.</p>`
  );
  const text = `${title}: ${l.name} <${l.email}>${l.phone ? ` · ${l.phone}` : ""}
Origem: ${l.tag}
${l.subject ? `Assunto: ${l.subject}\n` : ""}${l.message ?? ""}

${link}`;
  return { to, subject: `${title}: ${l.name}`, html, text, replyTo: l.email };
}

/** Resposta automática a quem preencheu um formulário (texto escrito no backoffice). */
export function formAutoReplyEmail(r: { to: string; subject: string; text: string }, replyTo: string): Email {
  const paragraphs = r.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(p)}</p>`)
    .join("");
  return { to: r.to, subject: r.subject, html: layout(r.subject, paragraphs), text: r.text, replyTo: replyTo || undefined };
}

export type SaleEmailData = {
  kind: "sale" | "refund";
  name: string;
  email: string;
  product: string;
  amount: string;
  reference: string | null;
  contactId: number;
};

export function saleNotificationEmail(s: SaleEmailData, to: string, appUrl: string): Email {
  const sale = s.kind === "sale";
  const title = sale ? "Nova venda na Hotmart" : "Reembolso na Hotmart";
  const html = layout(
    title,
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:26px;color:#18181b;margin:0 0 16px">${title}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${row("Produto", escapeHtml(s.product))}
${row("Valor", `<strong style="color:${sale ? "#047857" : "#be123c"}">${sale ? "" : "− "}${escapeHtml(s.amount)}</strong>`)}
${row(sale ? "Comprador" : "Cliente", `${escapeHtml(s.name)} · ${escapeHtml(s.email)}`)}
${s.reference ? row("Transação", escapeHtml(s.reference)) : ""}
</table>
${button(`${appUrl}/admin/crm/${s.contactId}`, "Abrir no CRM")}`
  );
  const text = `${title}: ${s.product} — ${s.amount}
${s.name} <${s.email}>${s.reference ? `\nTransação: ${s.reference}` : ""}

${appUrl}/admin/crm/${s.contactId}`;
  return { to, subject: `${title}: ${s.product} — ${s.amount}`, html, text };
}

export type EventReminderData = {
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  when: string; // "Daqui a 30 min", "Amanhã"…
};

/** `team`: notas e link da agenda só para a equipa; quem é de fora recebe apenas o essencial. */
export function eventReminderEmail(e: EventReminderData, to: string, appUrl: string, team = true): Email {
  const lastDay = new Date(e.endAt.getTime() - (e.allDay ? 86_400_000 : 0));
  const multi = fmtLongDate(lastDay) !== fmtLongDate(e.startAt);
  const date = multi ? `${fmtLongDate(e.startAt)} a ${fmtLongDate(lastDay)}` : fmtLongDate(e.startAt);
  const hour = e.allDay ? "Dia inteiro" : `${fmtTime(e.startAt)}–${fmtTime(e.endAt)} (Lisboa)`;
  const link = /^https?:\/\//i.test(e.location ?? "") ? e.location! : null;
  const html = layout(
    "Lembrete",
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#800080;font-weight:bold">${escapeHtml(e.when)}</p>
<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:28px;color:#18181b;margin:0 0 16px">${escapeHtml(e.title)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${row("Data", date)}
${row("Hora", hour)}
${e.location ? row("Local", link ? `<a href="${escapeHtml(link)}" style="color:#800080">${escapeHtml(link)}</a>` : escapeHtml(e.location)) : ""}
</table>
${team && e.notes ? `<div style="background:#f4f4f5;border-radius:12px;padding:16px;white-space:pre-wrap;color:#3f3f46;margin-bottom:20px">${escapeHtml(e.notes)}</div>` : ""}
${team ? button(`${appUrl}/admin/agenda`, "Abrir a agenda") : ""}`
  );
  const text = `${e.when}: ${e.title}
${date} · ${hour}
${e.location ?? ""}
${team ? (e.notes ?? "") : ""}`;
  return { to, subject: `Lembrete: ${e.title} — ${e.allDay ? date : `${fmtTime(e.startAt)}, ${date}`}`, html, text };
}

export type EventInviteData = {
  uid: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  name: string;
  email: string;
  timezone?: string | null;
  updated: boolean;
  repeat?: string | null; // "Semanal (terça)"
  rrule?: string | null;
};

/** Convite de um evento da agenda para o contacto ligado (as notas internas nunca vão). */
export function eventInviteEmail(e: EventInviteData, replyTo: string): Email {
  const first = e.name.trim().split(/\s+/)[0];
  const lastDay = new Date(e.endAt.getTime() - (e.allDay ? 86_400_000 : 0));
  const when = clientWhen({ startAt: e.startAt, timezone: e.timezone ?? HOME_TZ });
  const date = !e.allDay
    ? when.date
    : fmtLongDate(lastDay) !== fmtLongDate(e.startAt)
      ? `${fmtLongDate(e.startAt)} a ${fmtLongDate(lastDay)}`
      : fmtLongDate(e.startAt);
  const hour = e.allDay ? "Dia inteiro" : when.hour;
  const link = /^https?:\/\//i.test(e.location ?? "") ? e.location! : null;
  const title = e.updated ? "Evento atualizado" : "Convite";
  const html = layout(
    title,
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:28px;color:#18181b;margin:0 0 16px">Olá, ${escapeHtml(first)}.</h1>
<p style="margin:0 0 20px">${e.updated ? "Os detalhes deste evento foram atualizados:" : "Tem um novo evento na agenda com Marina Loyola:"}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
${row("Evento", escapeHtml(e.title))}
${row("Data", escapeHtml(date))}
${row("Hora", escapeHtml(hour))}
${e.repeat ? row("Repete", escapeHtml(e.repeat)) : ""}
${e.location && !link ? row("Local", escapeHtml(e.location)) : ""}
</table>
${link ? button(link, "Entrar na reunião") : ""}
<p style="margin:24px 0 0;font-size:13px;color:#71717a">O convite de calendário vai em anexo. Alguma dúvida? Basta responder a este email.</p>`
  );
  const text = `Olá, ${first}.

${e.updated ? "Evento atualizado" : "Novo evento"}: ${e.title}
Data: ${date}
Hora: ${hour}
${e.repeat ? `Repete: ${e.repeat}\n` : ""}${e.location ? `Local: ${e.location}\n` : ""}
Alguma dúvida? Basta responder a este email.
— Marina Loyola`;
  return {
    to: e.email,
    subject: `${e.updated ? "Atualizado" : "Convite"}: ${e.title} — ${date}`,
    html,
    text,
    replyTo,
    attachments: [{ filename: "evento.ics", content: eventIcs(e, replyTo), contentType: "text/calendar; method=REQUEST" }],
  };
}

function eventIcs(e: EventInviteData, organizer: string) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: HOME_TZ }).format(d).replace(/-/g, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marina Loyola//Agenda//PT",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${e.uid}@marinaloyola.com`,
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
    `DTSTAMP:${stamp(new Date())}`,
    e.allDay ? `DTSTART;VALUE=DATE:${day(e.startAt)}` : `DTSTART:${stamp(e.startAt)}`,
    e.allDay ? `DTEND;VALUE=DATE:${day(e.endAt)}` : `DTEND:${stamp(e.endAt)}`,
    ...(e.rrule ? [`RRULE:${e.rrule}`] : []),
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `ORGANIZER;CN=Marina Loyola:mailto:${organizer}`,
    `ATTENDEE;CN=${esc(e.name)};RSVP=TRUE:mailto:${e.email}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export type WelcomeEmailData = { name: string; email: string; password: string; role: string; courses: string[] };

/** Dados de acesso de uma conta nova (palavra-passe provisória, para trocar em Minha conta). */
export function welcomeEmail(w: WelcomeEmailData, appUrl: string, replyTo: string): Email {
  const first = w.name.trim().split(/\s+/)[0];
  const student = w.role === "student";
  const area = student ? "a sua área de estudante" : "o backoffice";
  const html = layout(
    "Boas-vindas",
    `<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:28px;color:#18181b;margin:0 0 16px">Olá, ${escapeHtml(first)}.</h1>
<p style="margin:0 0 20px">A sua conta na plataforma Marina Loyola está pronta. Estes são os dados para entrar em ${area}:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${row("Email", escapeHtml(w.email))}
${row("Palavra-passe", `<span style="font-family:Menlo,Consolas,monospace;font-size:15px;color:#18181b">${escapeHtml(w.password)}</span>`)}
${w.courses.length ? row(w.courses.length === 1 ? "Curso" : "Cursos", escapeHtml(w.courses.join(", "))) : ""}
</table>
${button(`${appUrl}/login`, "Entrar na plataforma")}
<p style="margin:24px 0 0;font-size:13px;color:#71717a">Por segurança, troque a palavra-passe no primeiro acesso em <b>Minha conta</b>. Alguma dúvida? Basta responder a este email.</p>`
  );
  const text = `Olá, ${first}.

A sua conta na plataforma Marina Loyola está pronta.
Email: ${w.email}
Palavra-passe: ${w.password}
${w.courses.length ? `Cursos: ${w.courses.join(", ")}\n` : ""}
Entrar: ${appUrl}/login

Por segurança, troque a palavra-passe no primeiro acesso em Minha conta.
— Marina Loyola`;
  return { to: w.email, subject: student ? "O seu acesso à área de estudante — Marina Loyola" : "O seu acesso à plataforma — Marina Loyola", html, text, replyTo };
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
