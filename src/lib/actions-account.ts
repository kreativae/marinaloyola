"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/db";
import { passkeys, users } from "@/db/schema";
import { createSession, getSessionUser, hashPassword, storeChallenge, takeChallenge, verifyPassword } from "@/lib/auth";
import { readRaw, saveSettings } from "@/lib/settings";
import { SESSION_DAYS } from "@/lib/login-guard";
import { allow } from "@/lib/rate-limit";

export type AccountResult = { ok: boolean; error?: string };

const RP_NAME = "Marina Loyola";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

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

/** Domínio e origem do pedido: a chave fica presa ao domínio onde foi criada (loy.kreativ.ae, localhost…). */
async function relyingParty() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  const hostname = host.split(":")[0];
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return { rpID: hostname, origin: `${proto}://${host}` };
}

/** Nome legível do aparelho a partir do navegador (iPhone · Safari, Mac · Chrome…). */
async function deviceName() {
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "Este aparelho";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${device} · ${browser}` : device;
}

export async function passkeyLoginEnabled() {
  const raw = await readRaw(["passkey_login"]);
  return raw.passkey_login !== "0";
}

/* --------------------------------- PERFIL -------------------------------- */

export async function updateMyProfile(_prev: AccountResult | null, fd: FormData): Promise<AccountResult> {
  const user = await me();
  const name = str(fd, "name").slice(0, 120);
  const email = str(fd, "email").toLowerCase();
  const phone = str(fd, "phone").slice(0, 40) || null;
  if (!name) return { ok: false, error: "Indique o nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email inválido." };
  if (phone && !/^\+?[\d\s().-]{6,}$/.test(phone)) return { ok: false, error: "Telefone inválido." };
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, sql`${users.id} <> ${user.id}`))
    .limit(1);
  if (clash) return { ok: false, error: "Já existe outra conta com esse email." };
  await db.update(users).set({ name, email, phone }).where(eq(users.id, user.id));
  refresh();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function changeMyPassword(_prev: AccountResult | null, fd: FormData): Promise<AccountResult> {
  const user = await me();
  const current = String(fd.get("current") ?? "");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!verifyPassword(current, user.passwordHash)) return { ok: false, error: "A palavra-passe atual não está certa." };
  if (password.length < 8) return { ok: false, error: "A nova palavra-passe precisa de pelo menos 8 caracteres." };
  if (password !== confirm) return { ok: false, error: "As palavras-passe não coincidem." };
  await db
    .update(users)
    .set({ passwordHash: hashPassword(password), passwordChangedAt: new Date() })
    .where(eq(users.id, user.id));
  // As outras sessões terminam; este aparelho continua com sessão nova
  await new Promise((r) => setTimeout(r, 5));
  await createSession(user.id);
  refresh();
  return { ok: true };
}

/* --------------------------- FACE ID (PASSKEYS) -------------------------- */

export async function passkeyRegisterOptions(): Promise<
  { ok: true; options: PublicKeyCredentialCreationOptionsJSON } | { ok: false; error: string }
> {
  const user = await me();
  const { rpID } = await relyingParty();
  const existing = await db
    .select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: (p.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    preferredAuthenticatorType: "localDevice",
  });
  await storeChallenge(options.challenge, user.id);
  return { ok: true, options };
}

export async function passkeyRegisterVerify(response: RegistrationResponseJSON): Promise<AccountResult> {
  const user = await me();
  const challenge = await takeChallenge(user.id);
  if (!challenge) return { ok: false, error: "O pedido expirou. Tente outra vez." };
  const { rpID, origin } = await relyingParty();
  try {
    const v = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!v.verified) return { ok: false, error: "Não foi possível confirmar o aparelho." };
    const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
    await db.insert(passkeys).values({
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: await deviceName(),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível ativar." };
  }
}

export async function passkeyLoginOptions(): Promise<
  { ok: true; options: PublicKeyCredentialRequestOptionsJSON } | { ok: false; error: string }
> {
  if (!(await passkeyLoginEnabled())) return { ok: false, error: "A entrada com Face ID está desativada." };
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await storeChallenge(options.challenge);
  return { ok: true, options };
}

export async function passkeyLoginVerify(
  response: AuthenticationResponseJSON
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  if (!(await passkeyLoginEnabled())) return { ok: false, error: "A entrada com Face ID está desativada." };
  if (!(await allow("passkey", 30, 15 * 60_000))) return { ok: false, error: "Demasiadas tentativas. Aguarde alguns minutos." };
  const challenge = await takeChallenge();
  if (!challenge) return { ok: false, error: "O pedido expirou. Tente outra vez." };
  const [row] = await db
    .select({ key: passkeys, user: users })
    .from(passkeys)
    .innerJoin(users, eq(users.id, passkeys.userId))
    .where(eq(passkeys.credentialId, response.id))
    .limit(1);
  if (!row) return { ok: false, error: "Este aparelho já não está associado a nenhuma conta. Entre com email e palavra-passe." };
  const { rpID, origin } = await relyingParty();
  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: row.key.credentialId,
        publicKey: new Uint8Array(Buffer.from(row.key.publicKey, "base64url")),
        counter: row.key.counter,
        transports: (row.key.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      },
    });
    if (!v.verified) return { ok: false, error: "Não foi possível confirmar a identidade." };
    const now = new Date();
    await db
      .update(passkeys)
      .set({ counter: v.authenticationInfo.newCounter, lastUsedAt: now })
      .where(eq(passkeys.id, row.key.id));
    await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, row.user.id));
    await createSession(row.user.id);
    return { ok: true, to: row.user.role === "student" ? "/aluno" : "/admin" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível entrar." };
  }
}

/** A própria pessoa gere as suas chaves; a Super Admin pode remover as de qualquer conta. */
async function ownKey(id: number) {
  const user = await me();
  const [key] = await db.select({ userId: passkeys.userId }).from(passkeys).where(eq(passkeys.id, id)).limit(1);
  if (!key) return null;
  if (key.userId !== user.id && user.role !== "admin") throw new Error("Sem permissão.");
  return key;
}

export async function renamePasskey(id: number, name: string): Promise<AccountResult> {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) return { ok: false, error: "Indique um nome." };
  if (!(await ownKey(id))) return { ok: true };
  await db.update(passkeys).set({ name: clean }).where(eq(passkeys.id, id));
  refresh();
  return { ok: true };
}

export async function deletePasskey(id: number): Promise<AccountResult> {
  if (!(await ownKey(id))) return { ok: true };
  await db.delete(passkeys).where(eq(passkeys.id, id));
  refresh();
  return { ok: true };
}

/* -------------------------------- SEGURANÇA ------------------------------ */

async function superAdmin() {
  const user = await me();
  if (user.role !== "admin") throw new Error("Sem permissão.");
  return user;
}

export async function saveSecuritySettings(_prev: AccountResult | null, fd: FormData): Promise<AccountResult> {
  await superAdmin();
  const days = Number(fd.get("session_days"));
  if (!(SESSION_DAYS as readonly number[]).includes(days)) return { ok: false, error: "Duração inválida." };
  await saveSettings({
    session_days: String(days),
    login_lockout: fd.get("login_lockout") === "1" ? "1" : "0",
    passkey_login: fd.get("passkey_login") === "1" ? "1" : "0",
  });
  refresh();
  revalidatePath("/login");
  return { ok: true };
}

/** Termina a sessão em todos os aparelhos e de todas as pessoas, mantendo a de quem carregou no botão. */
export async function revokeAllSessions(): Promise<AccountResult> {
  const user = await superAdmin();
  await saveSettings({ session_epoch: String(Date.now()) });
  await new Promise((r) => setTimeout(r, 5));
  await createSession(user.id);
  refresh();
  return { ok: true };
}
