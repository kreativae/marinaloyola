import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

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

export async function createSession(userId: number) {
  const store = await cookies();
  const payload = String(userId);
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
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
  const id = Number(payload);
  if (!Number.isInteger(id)) return null;
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
