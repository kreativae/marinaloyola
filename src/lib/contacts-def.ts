/** Regras para reconhecer a mesma pessoa em dois contactos (sem acesso à base de dados). */

export type Identity = { email?: string | null; phone?: string | null };

export const cleanEmail = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Só dígitos, sem 00 inicial e sem o 9 extra dos telemóveis do Brasil: o WhatsApp entrega muitas
 * vezes +55 11 8765-4321 para quem escreveu +55 11 98765-4321.
 */
export function canonPhone(raw: string | null | undefined) {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("55") && d[4] === "9") d = d.slice(0, 4) + d.slice(5);
  else if (d.length === 11 && d[0] !== "0" && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

/** Mesmo número, com ou sem indicativo do país. */
export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const [x, y] = [canonPhone(a), canonPhone(b)].sort((p, q) => p.length - q.length);
  if (x.length < 8) return false;
  return x === y || (x.length >= 9 && y.endsWith(x));
}

/** Os últimos 8 dígitos não mudam com indicativo nem com o 9 do Brasil: servem para a pesquisa. */
export const phoneTail = (raw: string | null | undefined) => {
  const d = canonPhone(raw);
  return d.length >= 8 ? d.slice(-8) : null;
};

/** Sem dados contraditórios: um pode completar o outro sem se perder nada. */
export function compatible(a: Identity, b: Identity) {
  const emailOk = !a.email || !b.email || cleanEmail(a.email) === cleanEmail(b.email);
  const phoneOk = !a.phone || !b.phone || samePhone(a.phone, b.phone);
  return emailOk && phoneOk;
}

/** Contactos criados pelo WhatsApp sem nome ficam com o número no lugar do nome. */
export const nameIsPhone = (name: string) => /^[+\d\s()-]+$/.test(name.trim());

/** Nome comparável, sem acentos; só nomes completos, porque "Ana" sozinho não identifica ninguém. */
export function fullNameKey(name: string) {
  const key = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  return key.split(" ").length >= 2 && !nameIsPhone(key) ? key : null;
}

export type DuplicateReason = "email" | "phone" | "name";

export const DUPLICATE_REASONS: Record<DuplicateReason, string> = {
  email: "Mesmo email",
  phone: "Mesmo telefone",
  name: "Mesmo nome",
};
