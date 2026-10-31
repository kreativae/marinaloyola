import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { readRaw } from "@/lib/settings";
import { SESSION_DAYS } from "@/lib/login-guard";

const SECRET = process.env.AUTH_SECRET ?? "marina-loyola-dev-secret";
const COOKIE = "ml_session";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const target = Buffer.from(hash, "hex");
  return candidate.length === target.length && crypto.timingSafeEqual(candidate, target);
}

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

/** Regras de sessão definidas em Configurações → Segurança. */
async function sessionRules() {
  const raw = await readRaw(["session_days", "session_epoch"]);
  const days = Number(raw.session_days);
  return {
    days: (SESSION_DAYS as readonly number[]).includes(days) ? days : 30,
    // Sessões criadas antes deste instante deixam de valer ("terminar todas as sessões")
    epoch: Number(raw.session_epoch) || 0,
  };
}

export async function createSession(userId: number) {
  const store = await cookies();
  const { days } = await sessionRules();
  const payload = `${userId}:${Date.now()}`;
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * days,
  });
}

/** Desafio WebAuthn guardado num cookie assinado durante 5 minutos (registo ou entrada). */
const CHALLENGE = "ml_webauthn";

export async function storeChallenge(challenge: string, userId = 0) {
  const store = await cookies();
  const payload = `${challenge}.${userId}.${Date.now() + 5 * 60_000}`;
  store.set(CHALLENGE, `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 300 });
}

export async function takeChallenge(userId = 0) {
  const store = await cookies();
  const raw = store.get(CHALLENGE)?.value;
  store.delete(CHALLENGE);
  if (!raw) return null;
  const [challenge, uid, exp, sig] = raw.split(".");
  const payload = `${challenge}.${uid}.${exp}`;
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(sig ?? "");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(uid) !== userId || Number(exp) < Date.now()) return null;
  return challenge;
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [uid, iat] = payload.split(":");
  const id = Number(uid);
  if (!Number.isInteger(id)) return null;
  // Cookies antigos (sem data) continuam válidos até haver um "terminar todas as sessões"
  const issued = Number(iat) || 0;
  const { days, epoch } = await sessionRules();
  if (issued < epoch) return null;
  if (issued && issued + days * 86_400_000 < Date.now()) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
});

/** Sem sessão válida: se havia cookie, a sessão expirou ou a conta foi removida. */
async function toLogin(): Promise<never> {
  const store = await cookies();
  redirect(store.has(COOKIE) ? "/login?sessao=expirada" : "/login");
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return toLogin();
  if (user.role === "student") redirect("/aluno");
  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) return toLogin();
  return user;
}
