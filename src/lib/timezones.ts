/**
 * Fusos horários e países das clientes. Sem dependências de servidor: usado também no browser.
 *
 * A agenda da Marina vive em Lisboa (fuso do servidor). Cada cliente vê e recebe os horários
 * no seu fuso; os instantes são guardados em UTC, por isso horário de verão e diferenças
 * entre países são tratados pelo Intl com as regras IANA.
 */

export const HOME_TZ = "Europe/Lisbon";

type Country = { code: string; tz: string; dial: string; zones?: { tz: string; label: string }[] };

/** Países com indicativo e fuso por omissão; os que têm vários fusos listam-nos. */
export const COUNTRIES: Country[] = [
  { code: "PT", tz: "Europe/Lisbon", dial: "351", zones: [
    { tz: "Europe/Lisbon", label: "Continente" },
    { tz: "Atlantic/Madeira", label: "Madeira" },
    { tz: "Atlantic/Azores", label: "Açores" },
  ] },
  { code: "BR", tz: "America/Sao_Paulo", dial: "55", zones: [
    { tz: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, GO, DF, BA…)" },
    { tz: "America/Fortaleza", label: "Nordeste (CE, PE, RN, PB, AL, MA, PI)" },
    { tz: "America/Belem", label: "Pará e Amapá" },
    { tz: "America/Manaus", label: "Amazonas, MT, MS, RO, RR" },
    { tz: "America/Rio_Branco", label: "Acre" },
    { tz: "America/Noronha", label: "Fernando de Noronha" },
  ] },
  { code: "AO", tz: "Africa/Luanda", dial: "244" },
  { code: "MZ", tz: "Africa/Maputo", dial: "258" },
  { code: "CV", tz: "Atlantic/Cape_Verde", dial: "238" },
  { code: "ES", tz: "Europe/Madrid", dial: "34", zones: [
    { tz: "Europe/Madrid", label: "Península" },
    { tz: "Atlantic/Canary", label: "Canárias" },
  ] },
  { code: "FR", tz: "Europe/Paris", dial: "33" },
  { code: "GB", tz: "Europe/London", dial: "44" },
  { code: "IE", tz: "Europe/Dublin", dial: "353" },
  { code: "DE", tz: "Europe/Berlin", dial: "49" },
  { code: "IT", tz: "Europe/Rome", dial: "39" },
  { code: "NL", tz: "Europe/Amsterdam", dial: "31" },
  { code: "BE", tz: "Europe/Brussels", dial: "32" },
  { code: "LU", tz: "Europe/Luxembourg", dial: "352" },
  { code: "CH", tz: "Europe/Zurich", dial: "41" },
  { code: "AT", tz: "Europe/Vienna", dial: "43" },
  { code: "DK", tz: "Europe/Copenhagen", dial: "45" },
  { code: "SE", tz: "Europe/Stockholm", dial: "46" },
  { code: "NO", tz: "Europe/Oslo", dial: "47" },
  { code: "FI", tz: "Europe/Helsinki", dial: "358" },
  { code: "PL", tz: "Europe/Warsaw", dial: "48" },
  { code: "GR", tz: "Europe/Athens", dial: "30" },
  { code: "AE", tz: "Asia/Dubai", dial: "971" },
  { code: "US", tz: "America/New_York", dial: "1", zones: [
    { tz: "America/New_York", label: "Leste (Nova Iorque, Miami)" },
    { tz: "America/Chicago", label: "Centro (Chicago, Texas)" },
    { tz: "America/Denver", label: "Montanha (Denver)" },
    { tz: "America/Los_Angeles", label: "Pacífico (Los Angeles)" },
  ] },
  { code: "CA", tz: "America/Toronto", dial: "1" },
  { code: "MX", tz: "America/Mexico_City", dial: "52" },
  { code: "AR", tz: "America/Argentina/Buenos_Aires", dial: "54" },
  { code: "CL", tz: "America/Santiago", dial: "56" },
  { code: "CO", tz: "America/Bogota", dial: "57" },
  { code: "UY", tz: "America/Montevideo", dial: "598" },
  { code: "AU", tz: "Australia/Sydney", dial: "61" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Fusos que aparecem primeiro no seletor da página de agendamento. */
export const FEATURED_ZONES = [
  "America/Sao_Paulo",
  "Europe/Lisbon",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "America/Fortaleza",
  "America/Manaus",
  "America/New_York",
  "Africa/Luanda",
];

let regionNames: Intl.DisplayNames | null = null;
export function countryName(code: string | null | undefined) {
  if (!code) return "";
  try {
    regionNames ??= new Intl.DisplayNames(["pt-PT"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** 🇧🇷 a partir de "BR". */
export const flag = (code: string | null | undefined) =>
  code && /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "";

export function isValidTz(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** País a que pertence um fuso (só para os fusos conhecidos). */
export function countryOfTz(tz: string | null | undefined): string | null {
  if (!tz) return null;
  for (const c of COUNTRIES) {
    if (c.tz === tz || c.zones?.some((z) => z.tz === tz)) return c.code;
  }
  return null;
}

export const defaultTzOf = (country: string | null | undefined) => (country ? BY_CODE.get(country)?.tz : undefined);
export const zonesOf = (country: string | null | undefined) => (country ? BY_CODE.get(country)?.zones : undefined);

/** País e fuso deduzidos do indicativo do telefone (+55…, +351…). */
export function inferFromPhone(phone: string | null | undefined): { country: string; timezone: string } | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  else if (!raw.startsWith("+")) {
    // Sem indicativo: números portugueses de 9 dígitos começados por 2 ou 9
    return /^[29]\d{8}$/.test(digits) ? { country: "PT", timezone: "Europe/Lisbon" } : null;
  }
  // Indicativo mais longo primeiro (351 antes de 35…, 55 antes de 5…)
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => digits.startsWith(c.dial));
  if (!match) return null;
  // DDD brasileiro → fuso do estado
  if (match.code === "BR") {
    const ddd = Number(digits.slice(2, 4));
    return { country: "BR", timezone: brazilTzOfDdd(ddd) };
  }
  return { country: match.code, timezone: match.tz };
}

function brazilTzOfDdd(ddd: number) {
  if (ddd === 68) return "America/Rio_Branco";
  if ([92, 97, 95, 69, 65, 66, 67].includes(ddd)) return "America/Manaus";
  if ([91, 93, 94, 96].includes(ddd)) return "America/Belem";
  if ([81, 87, 82, 83, 84, 85, 88, 86, 89, 98, 99].includes(ddd)) return "America/Fortaleza";
  return "America/Sao_Paulo";
}

/* ------------------------------- FORMATOS -------------------------------- */

/** Nome curto e legível de um fuso: "São Paulo", "Lisboa", "Açores". */
export function cityOf(tz: string) {
  const known: Record<string, string> = {
    "Europe/Lisbon": "Lisboa",
    "Atlantic/Azores": "Açores",
    "Atlantic/Madeira": "Madeira",
    "America/Sao_Paulo": "Brasília",
    "America/Fortaleza": "Fortaleza",
    "America/Manaus": "Manaus",
    "America/Belem": "Belém",
    "America/Rio_Branco": "Rio Branco",
    "America/Noronha": "Noronha",
    "Europe/London": "Londres",
    "Europe/Madrid": "Madrid",
    "Europe/Paris": "Paris",
    "Europe/Berlin": "Berlim",
    "Europe/Rome": "Roma",
    "Europe/Brussels": "Bruxelas",
    "Europe/Zurich": "Zurique",
    "America/New_York": "Nova Iorque",
    "Africa/Luanda": "Luanda",
    "Africa/Maputo": "Maputo",
  };
  return known[tz] ?? tz.split("/").pop()!.replace(/_/g, " ");
}

/** "GMT-3", "GMT+1"… no instante indicado (muda com o horário de verão). */
export function offsetLabel(tz: string, at = new Date()) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    return part === "GMT" ? "GMT+0" : (part ?? "");
  } catch {
    return "";
  }
}

/** Diferença em horas entre um fuso e Lisboa nesse instante (ex: -3, -4, +1). */
export function hoursFromHome(tz: string, at = new Date()) {
  const asUtc = (zone: string) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(at)
        .map((x) => [x.type, Number(x.value)])
    );
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  };
  return (asUtc(tz) - asUtc(HOME_TZ)) / 3_600_000;
}

export const fmtTime = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);

export const fmtDay = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);

/** Data AAAA-MM-DD de um instante num fuso. */
export function dayIn(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** Converte uma hora "de parede" num fuso IANA para o instante UTC correspondente. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, Number(p.value)])
    );
    const asTz = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return new Date(guess - (asTz - guess));
  } catch {
    return new Date(guess);
  }
}

/**
 * "quinta-feira, 30 de outubro, 10:00 (Brasília) · 14:00 em Lisboa" — ou só a hora de Lisboa
 * quando a cliente também está em Lisboa.
 */
export function dualDateTime(d: Date, tz: string | null | undefined) {
  const zone = isValidTz(tz) ? tz : HOME_TZ;
  const local = `${fmtDay(d, zone)}, ${fmtTime(d, zone)}`;
  if (fmtTime(d, zone) === fmtTime(d, HOME_TZ) && dayIn(d, zone) === dayIn(d, HOME_TZ)) {
    return zone === HOME_TZ ? `${local} (hora de Lisboa)` : `${local} (${cityOf(zone)} e Lisboa)`;
  }
  const sameDay = dayIn(d, zone) === dayIn(d, HOME_TZ);
  return `${local} (${cityOf(zone)}) · ${sameDay ? "" : `${fmtDay(d, HOME_TZ)}, `}${fmtTime(d, HOME_TZ)} em Lisboa`;
}
