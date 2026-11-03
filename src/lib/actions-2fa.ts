"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, getSessionUser, readPendingLogin, verifyPassword } from "@/lib/auth";
import { clearFailures, isLocked, registerFailure } from "@/lib/login-guard";
import { allow } from "@/lib/rate-limit";
import {
  checkTotp,
  formatSecret,
  newRecoveryCodes,
  newTotpSecret,
  openSecret,
  sealSecret,
  spendRecoveryCode,
  totpUri,
} from "@/lib/totp";

export type TwoFactorResult = { ok: boolean; error?: string; codes?: string[] };

async function me() {
  const user = await getSessionUser();
  if (!user) throw new Error("Sessão terminada. Entre novamente.");
  return user;
}

function refresh() {
  revalidatePath("/admin/conta");
  revalidatePath("/aluno/conta");
  revalidatePath("/admin/config");
}

/* --------------------------------- ENTRADA -------------------------------- */

/** Segundo passo do login: código da app (6 dígitos) ou um código de recuperação. */
export async function verifyTwoFactorLogin(fd: FormData) {
  const uid = await readPendingLogin();
  if (!uid) redirect("/login?erro=expirado");
  const lockKey = `2fa:${uid}`;
  if (isLocked(lockKey) || !(await allow("2fa", 20, 15 * 60_000))) {
    await readPendingLogin(true);
    redirect("/login?erro=bloqueado");
  }
  const code = String(fd.get("code") ?? "").trim().slice(0, 40);
  const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!user?.totpEnabledAt) redirect("/login?erro=expirado");

  const secret = openSecret(user.totpSecret);
  const step = secret ? checkTotp(secret, code, user.totpLastStep) : null;
  const left = step === null && /[a-z]/i.test(code) ? spendRecoveryCode(user.totpRecovery, code) : null;
  if (step === null && !left) {
    registerFailure(lockKey);
    if (isLocked(lockKey)) {
      await readPendingLogin(true);
      redirect("/login?erro=bloqueado");
    }
    redirect("/login/verificar?erro=1");
  }

  clearFailures(lockKey);
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), ...(step !== null ? { totpLastStep: step } : { totpRecovery: left }) })
    .where(eq(users.id, user.id));
  await readPendingLogin(true);
  await createSession(user.id);
  redirect(user.role === "student" ? "/aluno" : "/admin");
}

/* --------------------------------- ATIVAR --------------------------------- */

/** Gera um segredo novo (ainda inativo) e devolve o código QR para ler na app. */
export async function startTwoFactorSetup(): Promise<{ ok: true; qr: string; secret: string } | { ok: false; error: string }> {
  const user = await me();
  if (user.totpEnabledAt) return { ok: false, error: "A verificação em dois passos já está ativa." };
  const secret = newTotpSecret();
  await db.update(users).set({ totpSecret: sealSecret(secret), totpLastStep: null }).where(eq(users.id, user.id));
  const qr = await QRCode.toString(totpUri(secret, user.email), { type: "svg", margin: 1, color: { dark: "#18181b", light: "#ffffff" } });
  return { ok: true, qr, secret: formatSecret(secret) };
}

/** Confirma com o primeiro código da app; só então fica ativa e são criados os códigos de recuperação. */
export async function confirmTwoFactorSetup(code: string): Promise<TwoFactorResult> {
  const user = await me();
  if (user.totpEnabledAt) return { ok: false, error: "A verificação em dois passos já está ativa." };
  if (!(await allow("2fa-setup", 20, 15 * 60_000))) return { ok: false, error: "Demasiadas tentativas. Aguarde alguns minutos." };
  const secret = openSecret(user.totpSecret);
  if (!secret) return { ok: false, error: "O pedido expirou. Comece outra vez." };
  const step = checkTotp(secret, code, null);
  if (step === null) return { ok: false, error: "Código incorreto. Confira o código que aparece agora na app." };
  const { codes, hashes } = newRecoveryCodes();
  await db.update(users).set({ totpEnabledAt: new Date(), totpLastStep: step, totpRecovery: hashes }).where(eq(users.id, user.id));
  refresh();
  return { ok: true, codes };
}

/* ------------------------------ GERIR / DESATIVAR ------------------------------ */

async function checkPassword(fd: FormData) {
  const user = await me();
  if (!(await allow("2fa-manage", 10, 15 * 60_000))) return { user, error: "Demasiadas tentativas. Aguarde alguns minutos." };
  if (!verifyPassword(String(fd.get("password") ?? ""), user.passwordHash)) return { user, error: "Palavra-passe incorreta." };
  return { user, error: null };
}

export async function regenerateRecoveryCodes(_prev: TwoFactorResult | null, fd: FormData): Promise<TwoFactorResult> {
  const { user, error } = await checkPassword(fd);
  if (error) return { ok: false, error };
  if (!user.totpEnabledAt) return { ok: false, error: "A verificação em dois passos não está ativa." };
  const { codes, hashes } = newRecoveryCodes();
  await db.update(users).set({ totpRecovery: hashes }).where(eq(users.id, user.id));
  refresh();
  return { ok: true, codes };
}

export async function disableTwoFactor(_prev: TwoFactorResult | null, fd: FormData): Promise<TwoFactorResult> {
  const { user, error } = await checkPassword(fd);
  if (error) return { ok: false, error };
  await db.update(users).set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecovery: null }).where(eq(users.id, user.id));
  refresh();
  return { ok: true };
}

/** A Super Admin desliga o 2FA de alguém que perdeu o telemóvel e os códigos de recuperação. */
export async function resetUserTwoFactor(id: number): Promise<TwoFactorResult> {
  const admin = await me();
  if (admin.role !== "admin") return { ok: false, error: "Sem permissão." };
  await db.update(users).set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecovery: null }).where(eq(users.id, id));
  refresh();
  return { ok: true };
}
