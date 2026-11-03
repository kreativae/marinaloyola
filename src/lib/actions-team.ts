"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, tags, users } from "@/db/schema";
import { createSession, getSessionUser, hashPassword } from "@/lib/auth";
import { createAccount, type WelcomeStatus } from "@/lib/students";

export type TeamResult = { ok: boolean; error?: string; password?: string | null; welcome?: WelcomeStatus; name?: string };

const ROLES = ["admin", "staff", "student"] as const;
type Role = (typeof ROLES)[number];

/** Só a Super Admin gere contas (a equipa vê o backoffice, mas não mexe em acessos). */
async function requireSuperAdmin() {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") throw new Error("Sem permissão.");
  return me;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function adminCount() {
  const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
  return n;
}

async function emailTaken(email: string, exceptId?: number) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, exceptId ? sql`${users.id} <> ${exceptId}` : undefined))
    .limit(1);
  return !!row;
}

function refresh() {
  revalidatePath("/admin/config");
}

/* ------------------------------ UTILIZADORES ----------------------------- */

export async function saveUser(id: number | null, _prev: TeamResult | null, fd: FormData): Promise<TeamResult> {
  const me = await requireSuperAdmin();
  const name = str(fd, "name").slice(0, 120);
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") as Role;
  const password = String(fd.get("password") ?? "");

  if (!name) return { ok: false, error: "Indique o nome." };
  if (!emailOk(email)) return { ok: false, error: "Email inválido." };
  if (!ROLES.includes(role)) return { ok: false, error: "Escolha o perfil." };
  if (await emailTaken(email, id ?? undefined)) return { ok: false, error: "Já existe uma conta com esse email." };

  if (id === null) {
    // Vazia = gerada automaticamente (mostrada uma vez e enviada no email de boas-vindas)
    if (password && password.length < 8) return { ok: false, error: "A palavra-passe precisa de pelo menos 8 caracteres." };
    const contactId = Number(str(fd, "contactId")) || null;
    const r = await createAccount({
      name,
      email,
      role,
      phone: str(fd, "phone").slice(0, 40) || null,
      password: password || undefined,
      contactId,
      courseIds: role === "student" ? fd.getAll("courseId").map(Number) : [],
      sendWelcome: fd.get("sendWelcome") === "1",
    });
    refresh();
    if (contactId) revalidatePath(`/admin/crm/${contactId}`);
    revalidatePath("/admin/cursos");
    return { ok: true, password: r.password, welcome: r.welcome, name };
  } else {
    const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!current) return { ok: false, error: "Utilizador não encontrado." };
    if (current.role === "admin" && role !== "admin") {
      if (current.id === me.id) return { ok: false, error: "Não pode retirar o perfil de Super Admin à sua própria conta." };
      if ((await adminCount()) <= 1) return { ok: false, error: "Tem de ficar pelo menos uma Super Admin." };
    }
    await db.update(users).set({ name, email, role }).where(eq(users.id, id));
  }
  refresh();
  return { ok: true };
}

export async function setUserPassword(id: number, _prev: TeamResult | null, fd: FormData): Promise<TeamResult> {
  const me = await requireSuperAdmin();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, error: "A palavra-passe precisa de pelo menos 8 caracteres." };
  if (password !== confirm) return { ok: false, error: "As palavras-passe não coincidem." };
  // Também termina as sessões abertas dessa pessoa
  await db.update(users).set({ passwordHash: hashPassword(password), passwordChangedAt: new Date() }).where(eq(users.id, id));
  if (id === me.id) {
    await new Promise((r) => setTimeout(r, 5));
    await createSession(me.id);
  }
  return { ok: true };
}

export async function deleteUser(id: number): Promise<TeamResult> {
  const me = await requireSuperAdmin();
  if (id === me.id) return { ok: false, error: "Não pode apagar a sua própria conta." };
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  if (!u) return { ok: true };
  if (u.role === "admin" && (await adminCount()) <= 1) return { ok: false, error: "Tem de ficar pelo menos uma Super Admin." };
  await db.delete(users).where(eq(users.id, id));
  refresh();
  return { ok: true };
}

/** "Novo utilizador → importar de um contacto": contactos com email que ainda não têm conta. */
export async function searchContactsForAccount(q: string) {
  await requireSuperAdmin();
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({ id: contacts.id, name: contacts.name, email: contacts.email, phone: contacts.phone, status: contacts.status, userId: users.id })
    .from(contacts)
    .leftJoin(users, sql`lower(${users.email}) = lower(${contacts.email})`)
    .where(sql`(${contacts.name} ilike ${like} or ${contacts.email} ilike ${like} or ${contacts.phone} ilike ${like})`)
    .orderBy(contacts.name)
    .limit(8);
  return rows.map(({ userId, ...c }) => ({ ...c, hasAccount: userId !== null }));
}

/* --------------------------------- TAGS ---------------------------------- */

const cleanTag = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 60);

async function tagClash(name: string, exceptId?: number) {
  const [row] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(sql`lower(${tags.name}) = ${name.toLowerCase()}`, exceptId ? sql`${tags.id} <> ${exceptId}` : undefined))
    .limit(1);
  return !!row;
}

function refreshTags() {
  revalidatePath("/admin/config");
  revalidatePath("/admin/contactos");
}

export async function createTag(name: string, color: string): Promise<TeamResult> {
  await requireSuperAdmin();
  const clean = cleanTag(name);
  if (!clean) return { ok: false, error: "Indique o nome da tag." };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { ok: false, error: "Cor inválida." };
  if (await tagClash(clean)) return { ok: false, error: "Já existe uma tag com esse nome." };
  await db.insert(tags).values({ name: clean, color });
  refreshTags();
  return { ok: true };
}

export async function updateTag(id: number, name: string, color: string): Promise<TeamResult> {
  await requireSuperAdmin();
  const clean = cleanTag(name);
  if (!clean) return { ok: false, error: "Indique o nome da tag." };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { ok: false, error: "Cor inválida." };
  if (await tagClash(clean, id)) return { ok: false, error: "Já existe uma tag com esse nome." };
  await db.update(tags).set({ name: clean, color }).where(eq(tags.id, id));
  refreshTags();
  return { ok: true };
}

/** Apagar uma tag só a retira dos contactos; os contactos ficam. */
export async function deleteTag(id: number): Promise<TeamResult> {
  await requireSuperAdmin();
  await db.delete(tags).where(eq(tags.id, id));
  refreshTags();
  return { ok: true };
}
