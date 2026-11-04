import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, courses, enrollments, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { addInteraction, tagContact } from "@/lib/crm";
import { getEmailConfig, sendEmail, welcomeEmail } from "@/lib/email";

/**
 * Criação de contas (sobretudo de estudantes): palavra-passe aleatória, inscrição nos cursos,
 * ligação ao contacto do CRM e email de boas-vindas com os dados de acesso.
 */

/** 12 caracteres sem os que se confundem (0/O, 1/l/I), fácil de ditar ou copiar. */
export function newPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = Array.from(crypto.randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export type WelcomeStatus = "sent" | "preview" | "failed" | "off";

/** Liga a conta ao contacto (pelo id ou pelo email): tag "Estudante" e registo no histórico. */
async function linkContact(user: { name: string; email: string; role: string }, contactId: number | null, courseNames: string[]) {
  const [contact] = contactId
    ? await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    : await db.select().from(contacts).where(sql`lower(${contacts.email}) = ${user.email}`).limit(1);
  if (!contact) return;
  if (!contact.email) await db.update(contacts).set({ email: user.email }).where(eq(contacts.id, contact.id));
  if (user.role === "student") await tagContact(contact.id, "Estudante", "#10b981");
  const who = user.role === "student" ? "estudante" : user.role === "staff" ? "equipa" : "Super Admin";
  await addInteraction(
    contact.id,
    "system",
    `Conta de ${who} criada (${user.email})${courseNames.length ? ` com acesso a: ${courseNames.join(", ")}` : ""}.`
  );
}

export async function enrollInCourses(userId: number, courseIds: number[]) {
  const ids = [...new Set(courseIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];
  const rows = await db.select({ id: courses.id, title: courses.title }).from(courses).where(inArray(courses.id, ids));
  if (rows.length) await db.insert(enrollments).values(rows.map((c) => ({ userId, courseId: c.id }))).onConflictDoNothing();
  return rows.map((c) => c.title);
}

export async function createAccount(input: {
  name: string;
  email: string;
  role: "admin" | "staff" | "student";
  phone?: string | null;
  password?: string;
  contactId?: number | null;
  courseIds?: number[];
  sendWelcome?: boolean;
}) {
  const generated = !input.password;
  const password = input.password || newPassword();
  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      role: input.role,
      phone: input.phone || null,
      passwordHash: hashPassword(password),
    })
    .returning();
  const courseNames = await enrollInCourses(user.id, input.courseIds ?? []);
  await linkContact(user, input.contactId ?? null, courseNames);

  let welcome: WelcomeStatus = "off";
  if (input.sendWelcome) {
    try {
      const mail = await getEmailConfig();
      welcome = await sendEmail(welcomeEmail({ name: user.name, email: user.email, password, role: user.role, courses: courseNames }, mail.appUrl, mail.notifyEmail));
    } catch (e) {
      console.error("[email] boas-vindas falhou:", e);
      welcome = "failed";
    }
  }
  return { user, password: generated ? password : null, welcome, courseNames };
}

/** A conta que já existe para este email (qualquer perfil), se houver. */
export async function accountForEmail(email: string | null | undefined) {
  if (!email) return null;
  const [u] = await db
    .select({ id: users.id, role: users.role, name: users.name })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`))
    .limit(1);
  return u ?? null;
}
