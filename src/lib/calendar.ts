import { getSettings, isOn } from "@/lib/settings";
import { zonedToUtc } from "@/lib/timezones";

/**
 * Google Calendar sem OAuth:
 *  - exportação: feed iCal secreto com os agendamentos (Google → "Adicionar calendário → A partir do URL");
 *  - importação: o "endereço secreto em formato iCal" do Google, lido para bloquear horários ocupados.
 */

export type Busy = { start: Date; end: Date; title?: string };

/* ------------------------------- EXPORTAÇÃO ------------------------------ */

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEsc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildFeed(
  events: { id: number; title: string; description: string; url: string | null; startAt: Date; endAt: Date; createdAt: Date }[]
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marina Loyola//Agenda//PT",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Marina Loyola — Agendamentos",
    "X-WR-TIMEZONE:Europe/Lisbon",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:agendamento-${e.id}@marinaloyola.com`,
      `DTSTAMP:${icsStamp(e.createdAt)}`,
      `DTSTART:${icsStamp(e.startAt)}`,
      `DTEND:${icsStamp(e.endAt)}`,
      `SUMMARY:${icsEsc(e.title)}`,
      `DESCRIPTION:${icsEsc(e.description)}`,
      ...(e.url ? [`URL:${e.url}`, `LOCATION:${icsEsc(e.url)}`] : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  // Linhas com mais de 75 octetos são dobradas (RFC 5545 §3.1)
  return lines.map((l) => l.replace(/(.{74})(?=.)/g, "$1\r\n ")).join("\r\n") + "\r\n";
}

/* ------------------------------- IMPORTAÇÃO ------------------------------ */

function parseIcsDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { date: zonedToUtc(+y, +mo, +d, 0, 0, 0, "Europe/Lisbon"), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  const tz = params.match(/TZID=([^;:]+)/)?.[1] ?? "Europe/Lisbon";
  return { date: zonedToUtc(+y, +mo, +d, +h, +mi, +s, tz), allDay: false };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Lê os eventos ocupados de um ficheiro iCal, expandindo repetições diárias/semanais/mensais. */
export function parseBusy(ics: string, from: Date, to: Date): Busy[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const out: Busy[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const props: { name: string; params: string; value: string }[] = [];
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
      if (m) props.push({ name: m[1], params: m[2], value: m[3].trim() });
    }
    const get = (n: string) => props.find((p) => p.name === n);
    if (get("STATUS")?.value === "CANCELLED" || get("TRANSP")?.value === "TRANSPARENT") continue;
    const ds = get("DTSTART");
    if (!ds) continue;
    const start = parseIcsDate(ds.value, ds.params);
    if (!start) continue;
    const summary = get("SUMMARY")?.value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
    const de = get("DTEND");
    const endParsed = de ? parseIcsDate(de.value, de.params) : null;
    const dur =
      endParsed ? endParsed.date.getTime() - start.date.getTime() : start.allDay ? 86_400_000 : 0;
    if (dur <= 0) continue;

    const excluded = new Set(
      props
        .filter((p) => p.name === "EXDATE")
        .flatMap((p) => p.value.split(",").map((v) => parseIcsDate(v, p.params)?.date.getTime()))
    );
    const push = (s: Date) => {
      if (excluded.has(s.getTime())) return;
      const e = new Date(s.getTime() + dur);
      if (e > from && s < to) out.push({ start: s, end: e, ...(summary && { title: summary }) });
    };

    const rrule = get("RRULE")?.value;
    if (!rrule) {
      push(start.date);
      continue;
    }
    const rule = Object.fromEntries(rrule.split(";").map((kv) => kv.split("=")));
    const freq = rule.FREQ;
    const interval = Math.max(1, Number(rule.INTERVAL) || 1);
    const count = Number(rule.COUNT) || Infinity;
    const until = rule.UNTIL ? parseIcsDate(rule.UNTIL, "")?.date ?? to : to;
    const byDay = rule.BYDAY ? rule.BYDAY.split(",").map((d: string) => DAY_CODES.indexOf(d.slice(-2))) : null;
    const limit = until < to ? until : to;

    let n = 0;
    // Passo de 1 dia preserva a hora local (o fuso do servidor é Europe/Lisbon)
    const cur = new Date(start.date);
    // Sem COUNT, salta directamente para perto da janela (múltiplo do período, para manter o ritmo)
    const period = freq === "DAILY" ? interval : freq === "WEEKLY" ? 7 * interval : 0;
    if (!rule.COUNT && period && start.date < from) {
      const days = Math.floor((from.getTime() - start.date.getTime()) / 86_400_000);
      cur.setDate(cur.getDate() + Math.max(0, Math.floor(days / period) - 1) * period);
    }
    for (let i = 0; cur <= limit && n < count && i < 40_000; i++) {
      const daysFrom = Math.round((cur.getTime() - start.date.getTime()) / 86_400_000);
      let match = false;
      if (freq === "DAILY") match = daysFrom % interval === 0;
      else if (freq === "WEEKLY") {
        const week = Math.floor((daysFrom + start.date.getDay()) / 7);
        match = week % interval === 0 && (byDay ? byDay.includes(cur.getDay()) : cur.getDay() === start.date.getDay());
      } else if (freq === "MONTHLY") {
        const months = (cur.getFullYear() - start.date.getFullYear()) * 12 + cur.getMonth() - start.date.getMonth();
        match = cur.getDate() === start.date.getDate() && months % interval === 0;
      } else if (freq === "YEARLY") {
        match = cur.getDate() === start.date.getDate() && cur.getMonth() === start.date.getMonth();
      }
      if (match) {
        n++;
        push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  return out;
}

/* --------------------------- SINCRONIZAÇÃO ---------------------------- */

type SyncState = { url: string; at: number; tried: number; busy: Busy[]; error: string | null };
// Em globalThis para ser o mesmo estado em todas as rotas do servidor
const g = globalThis as unknown as { __gcalSync?: SyncState };
const state = (): SyncState => (g.__gcalSync ??= { url: "", at: 0, tried: 0, busy: [], error: null });

async function fetchIcs(url: string) {
  const res = await fetch(url.replace(/^webcal:/, "https:"), { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`O calendário respondeu ${res.status}.`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("O endereço não devolveu um calendário iCal.");
  return text;
}

const windowFrom = () => new Date(Date.now() - 35 * 86_400_000);
const windowTo = () => new Date(Date.now() + 130 * 86_400_000);

async function calendarSettings() {
  const m = await getSettings(["gcal_ical_url", "gcal_block_busy", "gcal_sync_minutes"]);
  return { url: m.gcal_ical_url, block: isOn(m.gcal_block_busy), minutes: Math.max(1, Number(m.gcal_sync_minutes) || 5) };
}

/** Lê o calendário agora, ignorando o intervalo. Uma falha mantém os últimos eventos lidos. */
export async function syncCalendar(): Promise<{ ok: boolean; count: number; error?: string; at: number }> {
  const { url } = await calendarSettings();
  const st = state();
  if (!url) return { ok: false, count: 0, error: "Google Calendar não está configurado.", at: st.at };
  try {
    const busy = parseBusy(await fetchIcs(url), windowFrom(), windowTo());
    g.__gcalSync = { url, at: Date.now(), tried: Date.now(), busy, error: null };
    return { ok: true, count: busy.length, at: Date.now() };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Falha a ler o calendário.";
    console.error("[calendar] leitura do iCal falhou:", e);
    g.__gcalSync = st.url === url ? { ...st, tried: Date.now(), error } : { url, at: 0, tried: Date.now(), busy: [], error };
    return { ok: false, count: 0, error, at: st.at };
  }
}

/** Horários ocupados do Google Calendar, relidos de acordo com o intervalo das Configurações. Falhas não bloqueiam as marcações. */
export async function getBusy(): Promise<Busy[]> {
  const { url, block, minutes } = await calendarSettings();
  if (!url || !block) return [];
  const st = state();
  // Depois de uma falha, espera também o intervalo antes de tentar outra vez
  if (st.url !== url || Date.now() - Math.max(st.at, st.tried) >= minutes * 60_000) await syncCalendar();
  return state().url === url ? state().busy : [];
}

/** Para o botão da Agenda: quando foi a última leitura e de quanto em quanto tempo. */
export async function calendarStatus() {
  const { url, block, minutes } = await calendarSettings();
  const st = state();
  const same = st.url === url;
  return { configured: Boolean(url), block, minutes, at: same ? st.at : 0, error: same ? st.error : null };
}

/** Para o botão de teste: lê sem cache e conta os eventos das próximas semanas. */
export async function testCalendar(url: string) {
  const busy = parseBusy(await fetchIcs(url), new Date(), new Date(Date.now() + 30 * 86_400_000));
  state().at = 0;
  return busy;
}
