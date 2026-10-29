"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  availability,
  contacts,
  courses,
  deals,
  enrollments,
  eventTypes,
  lessonProgress,
  lessons,
  modules,
  payments,
  pipelineStages,
  posts,
  users,
} from "@/db/schema";
import { hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { addInteraction, tagContact } from "@/lib/crm";
import { eur } from "@/lib/utils";

const CONTACT_STATUSES = ["lead", "qualified", "negotiating", "client", "inactive", "lost"] as const;
const PAYMENT_STATUSES = ["pending", "confirmed", "completed", "refunded", "cancelled"] as const;
const APPT_STATUSES = ["confirmed", "cancelled", "rescheduled", "completed"] as const;
const POST_STATUSES = ["idea", "production", "review", "approved", "published"] as const;

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

/* ------------------------------- PIPELINE ------------------------------- */

export async function moveDeal(dealId: number, stageId: number) {
  await requireAdmin();
  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
  if (!stage) return;
  const [deal] = await db
    .update(deals)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(deals.id, dealId))
    .returning();
  if (deal) {
    await addInteraction(deal.contactId, "system", `Pipeline: movido para "${stage.name}".`);
  }
  refresh("/admin/pipeline", "/admin", "/admin/crm");
}

export async function createDeal(formData: FormData) {
  await requireAdmin();
  const contactId = Number(formData.get("contactId"));
  const stageId = Number(formData.get("stageId"));
  const title = String(formData.get("title") ?? "").trim();
  const product = String(formData.get("product") ?? "Mentoria");
  const value = String(Number(formData.get("value") ?? 0).toFixed(2));
  if (!contactId || !stageId || !title) return;
  await db.insert(deals).values({ contactId, stageId, title, product, value });
  await addInteraction(contactId, "system", `Negócio criado no pipeline: "${title}" (${product}).`);
  redirect("/admin/pipeline");
}

/* --------------------------------- CRM ---------------------------------- */

export async function setContactStatus(contactId: number, status: string) {
  await requireAdmin();
  if (!CONTACT_STATUSES.includes(status as never)) return;
  await db
    .update(contacts)
    .set({ status: status as (typeof CONTACT_STATUSES)[number] })
    .where(eq(contacts.id, contactId));
  await addInteraction(contactId, "system", `Estado alterado para "${status}".`);
  refresh("/admin/crm", "/admin", `/admin/crm/${contactId}`);
}

export async function addContactNote(contactId: number, formData: FormData) {
  await requireAdmin();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await addInteraction(contactId, "note", content);
  refresh(`/admin/crm/${contactId}`);
}

export async function createContact(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const sourceRaw = String(formData.get("source") ?? "manual");
  const source = (["whatsapp", "hotmart", "site", "social", "referral", "manual"].includes(sourceRaw)
    ? sourceRaw
    : "manual") as "whatsapp" | "hotmart" | "site" | "social" | "referral" | "manual";
  if (!name || !email) redirect("/admin/contactos");
  const [existing] = await db.select().from(contacts).where(eq(contacts.email, email)).limit(1);
  if (!existing) {
    await db.insert(contacts).values({ name, email, phone, location, source });
  }
  redirect("/admin/contactos");
}

/* ------------------------------ PAGAMENTOS ------------------------------ */

export async function addPayment(formData: FormData) {
  await requireAdmin();
  const contactId = Number(formData.get("contactId"));
  const product = String(formData.get("product") ?? "").trim();
  const amount = String(Number(formData.get("amount") ?? 0).toFixed(2));
  const methodRaw = String(formData.get("method") ?? "transfer");
  const method = (["hotmart", "mbway", "transfer", "other"].includes(methodRaw)
    ? methodRaw
    : "transfer") as "hotmart" | "mbway" | "transfer" | "other";
  const statusRaw = String(formData.get("status") ?? "pending");
  const status = (PAYMENT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as (typeof PAYMENT_STATUSES)[number])
    : "pending";
  const reference = String(formData.get("reference") ?? "").trim() || null;
  if (!contactId || !product) return;
  await db.insert(payments).values({ contactId, product, amount, method, status, reference });
  await addInteraction(
    contactId,
    "purchase",
    `Pagamento registado: ${product} — ${eur(amount)} via ${method} (${status}).`
  );
  await tagContact(contactId, `Comprador ${product}`, "#a855f7");
  refresh("/admin/financeiro", "/admin", `/admin/crm/${contactId}`);
}

export async function setPaymentStatus(id: number, status: string) {
  await requireAdmin();
  if (!(PAYMENT_STATUSES as readonly string[]).includes(status)) return;
  const [p] = await db
    .update(payments)
    .set({ status: status as (typeof PAYMENT_STATUSES)[number] })
    .where(eq(payments.id, id))
    .returning();
  if (p) {
    await addInteraction(p.contactId, "system", `Pagamento #${p.id} (${p.product}) → "${status}".`);
  }
  refresh("/admin/financeiro", "/admin");
}

/* -------------------------------- AGENDA -------------------------------- */

export async function setAppointmentStatus(id: number, status: string) {
  await requireAdmin();
  if (!(APPT_STATUSES as readonly string[]).includes(status)) return;
  await db
    .update(appointments)
    .set({ status: status as (typeof APPT_STATUSES)[number] })
    .where(eq(appointments.id, id));
  refresh("/admin/agenda", "/admin");
}

export async function createEventType(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const durationMin = Math.max(5, Number(formData.get("durationMin") ?? 30));
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;
  await db.insert(eventTypes).values({ name, durationMin, description });
  refresh("/admin/agenda");
}

export async function updateAvailability(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const startTime = String(formData.get("startTime") ?? "09:00");
  const endTime = String(formData.get("endTime") ?? "18:00");
  const active = formData.get("active") === "on";
  if (!id) return;
  await db.update(availability).set({ startTime, endTime, active }).where(eq(availability.id, id));
  refresh("/admin/agenda");
}

/* --------------------------------- LMS ---------------------------------- */

export async function toggleCourse(id: number) {
  await requireAdmin();
  const [found] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  if (!found) return;
  await db.update(courses).set({ published: !found.published }).where(eq(courses.id, id));
  refresh("/admin/cursos", "/cursos");
}

export async function createModule(formData: FormData) {
  await requireAdmin();
  const courseId = Number(formData.get("courseId"));
  const title = String(formData.get("title") ?? "").trim();
  if (!courseId || !title) return;
  const [row] = await db.select({ m: max(modules.order) }).from(modules).where(eq(modules.courseId, courseId));
  await db.insert(modules).values({ courseId, title, order: (row?.m ?? 0) + 1 });
  refresh(`/admin/cursos/${courseId}`);
}

export async function createLesson(formData: FormData) {
  await requireAdmin();
  const moduleId = Number(formData.get("moduleId"));
  const courseId = Number(formData.get("courseId"));
  const title = String(formData.get("title") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "video");
  const type = (["video", "material", "quiz"].includes(typeRaw) ? typeRaw : "video") as
    | "video"
    | "material"
    | "quiz";
  const durationMin = Math.max(1, Number(formData.get("durationMin") ?? 10));
  const videoUrl = String(formData.get("videoUrl") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim() || null;
  if (!moduleId || !title) return;
  const [row] = await db.select({ m: max(lessons.order) }).from(lessons).where(eq(lessons.moduleId, moduleId));
  const [created] = await db
    .insert(lessons)
    .values({ moduleId, title, type, durationMin, videoUrl, content, order: (row?.m ?? 0) + 1 })
    .returning({ id: lessons.id });
  refresh(`/admin/cursos/${courseId}`);
  // Um quiz novo abre directamente no editor do banco de questões
  if (type === "quiz") redirect(`/admin/cursos/${courseId}/quiz/${created.id}`);
}

export async function enrollStudent(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const courseId = Number(formData.get("courseId"));
  if (!email || !courseId) return;
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        name: name || email.split("@")[0],
        email,
        passwordHash: hashPassword("aluno123"),
        role: "student",
      })
      .returning();
  }
  await db.insert(enrollments).values({ userId: user.id, courseId }).onConflictDoNothing();
  refresh(`/admin/cursos/${courseId}`);
}

export async function completeLesson(lessonId: number) {
  const user = await requireUser();
  await db
    .insert(lessonProgress)
    .values({ userId: user.id, lessonId })
    .onConflictDoNothing();
}

/* ------------------------------ MARKETING ------------------------------- */

export async function createPost(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const publishRaw = String(formData.get("publishAt") ?? "");
  const network = String(formData.get("network") ?? "Instagram");
  const format = String(formData.get("format") ?? "Carrossel");
  if (!title) return;
  const publishAt = publishRaw ? new Date(publishRaw) : null;
  await db.insert(posts).values({
    title,
    publishAt: publishAt && !Number.isNaN(publishAt.getTime()) ? publishAt : null,
    network,
    format,
    status: "idea",
  });
  refresh("/admin/marketing");
}

export async function movePost(id: number, status: string) {
  await requireAdmin();
  if (!(POST_STATUSES as readonly string[]).includes(status)) return;
  await db
    .update(posts)
    .set({ status: status as (typeof POST_STATUSES)[number] })
    .where(eq(posts.id, id));
  refresh("/admin/marketing");
}

export async function deletePost(id: number) {
  await requireAdmin();
  await db.delete(posts).where(eq(posts.id, id));
  refresh("/admin/marketing");
}

