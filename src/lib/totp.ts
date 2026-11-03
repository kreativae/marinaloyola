import crypto from "node:crypto";
import { deriveKey } from "@/lib/auth";

/**
 * Verificação em dois passos com app autenticadora (Google Authenticator, Microsoft Authenticator,
 * 1Password, Authy…): códigos TOTP de 6 dígitos que mudam a cada 30 segundos (RFC 6238).
 * O segredo fica cifrado na base de dados; os códigos de recuperação só em hash.
 */

const STEP = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Segredo novo em base32 (160 bits, o tamanho que todas as apps aceitam). */
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

/** Segredo agrupado de 4 em 4 para escrever à mão na app. */
export const formatSecret = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;

function codeAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = h[h.length - 1] & 15;
  const bin = h.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Confere um código, aceitando o intervalo anterior e o seguinte (relógio do telemóvel adiantado ou atrasado).
 * Devolve o intervalo aceite, ou null; códigos de um intervalo já usado são recusados.
 */
export function checkTotp(secret: string, code: string, lastStep: number | null) {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== DIGITS) return null;
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep != null && step <= lastStep) continue;
    const a = Buffer.from(codeAt(secret, step));
    if (crypto.timingSafeEqual(a, Buffer.from(clean))) return step;
  }
  return null;
}

/** Link que a app autenticadora lê no código QR. */
export function totpUri(secret: string, account: string) {
  const issuer = "Marina Loyola";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/* ------------------------------ CIFRA DO SEGREDO ------------------------------ */

export function sealSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", deriveKey("totp"), iv);
  const data = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

/** null se o AUTH_SECRET mudou desde que foi cifrado (nesse caso só os códigos de recuperação servem). */
export function openSecret(sealed: string | null | undefined) {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", deriveKey("totp"), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* --------------------------- CÓDIGOS DE RECUPERAÇÃO --------------------------- */

const hashRecovery = (code: string) =>
  crypto.createHash("sha256").update(code.toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

/** 10 códigos no formato xxxxx-xxxxx; devolve os códigos (mostrados uma vez) e os hashes a guardar. */
export function newRecoveryCodes() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes = Array.from({ length: 10 }, () => {
    const raw = Array.from(crypto.randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashRecovery) };
}

/** Se o código de recuperação for válido, devolve a lista sem ele (fica gasto). */
export function spendRecoveryCode(hashes: string[] | null | undefined, code: string) {
  const h = hashRecovery(code);
  if (!hashes?.length || h.length !== 64) return null;
  const i = hashes.findIndex((x) => crypto.timingSafeEqual(Buffer.from(x), Buffer.from(h)));
  return i === -1 ? null : hashes.filter((_, j) => j !== i);
}
