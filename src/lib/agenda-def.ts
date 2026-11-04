/**
 * Repetição e lembretes dos eventos da Agenda (partilhado entre o formulário e o servidor).
 * Cada ocorrência é guardada como um evento próprio; as da mesma série partilham o seriesId.
 */

export type RepeatFreq = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly";
export type RepeatRule = { freq: RepeatFreq; until: string | null; count: number | null };

export const REPEAT_OPTIONS: { value: RepeatFreq | "none"; label: string }[] = [
  { value: "none", label: "Não repete" },
  { value: "daily", label: "Todos os dias" },
  { value: "weekdays", label: "Dias úteis (seg–sex)" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

export const REMIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Não avisar" },
  { value: "0", label: "Na hora" },
  { value: "10", label: "10 min antes" },
  { value: "30", label: "30 min antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "1440", label: "1 dia antes" },
  { value: "10080", label: "1 semana antes" },
];

/** Hora a que tocam os lembretes dos eventos de dia inteiro (no próprio dia). */
export const ALL_DAY_REMIND_HOUR = 9;

/** Sem data de fim, as repetições são criadas até este horizonte. */
export const REPEAT_HORIZON_MONTHS = 12;
export const MAX_OCCURRENCES = 400;

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function isRepeatFreq(v: string): v is RepeatFreq {
  return REPEAT_OPTIONS.some((o) => o.value === v && v !== "none");
}

/** "Semanal às terças · até 30/06/2027" — para mostrar no calendário. */
export function repeatLabel(rule: RepeatRule | null | undefined, start?: Date) {
  if (!rule) return null;
  const base =
    rule.freq === "weekly" && start
      ? `Semanal (${WEEKDAYS[start.getDay()]})`
      : rule.freq === "biweekly" && start
        ? `Quinzenal (${WEEKDAYS[start.getDay()]})`
        : rule.freq === "monthly" && start
          ? `Mensal (dia ${start.getDate()})`
          : (REPEAT_OPTIONS.find((o) => o.value === rule.freq)?.label ?? "Repete");
  const end = rule.count
    ? ` · ${rule.count} vezes`
    : rule.until
      ? ` · até ${rule.until.split("-").reverse().join("/")}`
      : "";
  return base + end;
}

/** Regra iCal do convite: COUNT é o número real de ocorrências criadas. */
export function repeatRRule(rule: RepeatRule, count: number) {
  const base: Record<RepeatFreq, string> = {
    daily: "FREQ=DAILY",
    weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    weekly: "FREQ=WEEKLY",
    biweekly: "FREQ=WEEKLY;INTERVAL=2",
    monthly: "FREQ=MONTHLY",
    yearly: "FREQ=YEARLY",
  };
  return `${base[rule.freq]};COUNT=${count}`;
}

export function remindLabel(min: number | null | undefined) {
  if (min == null) return null;
  return REMIND_OPTIONS.find((o) => o.value === String(min))?.label ?? `${min} min antes`;
}

/** Dia N do mês seguinte, limitado ao último dia do mês (31 → 30/28). */
function addMonths(d: Date, months: number, day: number) {
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last), d.getHours(), d.getMinutes());
}

/**
 * Inícios das ocorrências (a primeira é o próprio início), na hora local do servidor (Lisboa).
 * Pára na data de fim, no número de vezes, no horizonte ou no limite de segurança.
 */
export function occurrences(start: Date, rule: RepeatRule): Date[] {
  const horizon = new Date(start);
  horizon.setMonth(horizon.getMonth() + (rule.freq === "yearly" ? 60 : REPEAT_HORIZON_MONTHS));
  let limit = horizon;
  if (rule.until) {
    const [y, m, d] = rule.until.split("-").map(Number);
    const until = new Date(y, m - 1, d + 1); // inclui o próprio dia
    if (until < limit || rule.freq === "yearly") limit = until;
  }
  const max = Math.min(rule.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const day = start.getDate();
  const out: Date[] = [];
  for (let i = 0; out.length < max && i < 2000; i++) {
    let cur: Date;
    if (rule.freq === "monthly") cur = addMonths(start, i, day);
    else if (rule.freq === "yearly") cur = addMonths(start, i * 12, day);
    else {
      const step = rule.freq === "weekly" ? 7 : rule.freq === "biweekly" ? 14 : 1;
      cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * step, start.getHours(), start.getMinutes());
    }
    if (cur >= limit) break;
    if (rule.freq === "weekdays" && (cur.getDay() === 0 || cur.getDay() === 6)) continue;
    out.push(cur);
  }
  return out;
}

/** Emails extra do lembrete: separados por vírgula, espaço ou linha; no máximo 5. */
export function parseEmails(raw: string) {
  const list = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const valid = list.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return { emails: [...new Set(valid)].slice(0, 5), invalid: list.filter((e) => !valid.includes(e)) };
}
