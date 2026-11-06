"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, formSubmissions, forms, pipelineStages } from "@/db/schema";
import { getSessionUser, requireAdmin } from "@/lib/auth";
import { addInteraction, findOrCreateContact, tagContact } from "@/lib/crm";
import { formAutoReplyEmail, getEmailConfig, leadNotificationEmail, notifyTeam, sendEmail } from "@/lib/email";
import { cleanFields, formPath, readAnswers, slugify, starterFields, type FormField } from "@/lib/forms-def";
import { allow } from "@/lib/rate-limit";

export type FormResult = { ok: boolean; error?: string; id?: number };
export type SubmitResult = { ok: boolean; error?: string; errors?: Record<string, string> };

const refresh = (id?: number) => {
  revalidatePath("/admin/formularios");
  if (id) revalidatePath(`/admin/formularios/${id}`);
  revalidatePath("/admin", "layout");
};

async function freeSlug(wanted: string) {
  const root = slugify(wanted) || "formulario";
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? root : `${root.slice(0, 55)}-${i}`;
    const [taken] = await db.select({ id: forms.id }).from(forms).where(eq(forms.slug, slug)).limit(1);
    if (!taken) return slug;
  }
  return `${root.slice(0, 50)}-${Date.now()}`;
}

/* ------------------------------- PÚBLICO --------------------------------- */

export async function submitForm(formId: number, _prev: SubmitResult | null, fd: FormData): Promise<SubmitResult> {
  const [form] = await db.select().from(forms).where(and(eq(forms.id, Number(formId) || 0), eq(forms.active, true))).limit(1);
  if (!form) return { ok: false, error: "Este formulário já não está disponível." };
  // Campo escondido que só robôs preenchem: finge que correu bem e não guarda nada
  if (String(fd.get("website") ?? "")) return { ok: true };
  if (!(await allow("form", 8, 10 * 60_000))) return { ok: false, error: "Foram feitos muitos envios. Tente de novo daqui a alguns minutos." };

  const { answers, errors } = readAnswers(form.fields, (id) => fd.getAll(`f_${id}`).map(String));
  if (Object.keys(errors).length) return { ok: false, errors, error: "Reveja os campos assinalados." };

  const value = (id: string) => answers.find((a) => a.id === id)?.value ?? "";
  const name = value("name").slice(0, 120);
  const email = value("email").toLowerCase().slice(0, 200);
  const phoneField = form.fields.find((f) => f.type === "phone");
  const phone = phoneField ? value(phoneField.id).slice(0, 40) || null : null;

  const { contact, created } = await findOrCreateContact({ name, email, phone, source: "site" });
  if (form.tag) await tagContact(contact.id, form.tag, "#800080");
  if (form.channelId && !contact.channelId) await db.update(contacts).set({ channelId: form.channelId }).where(eq(contacts.id, contact.id));

  await db.insert(formSubmissions).values({
    formId: form.id,
    contactId: contact.id,
    name,
    email,
    phone,
    answers,
    origin: String(fd.get("origin") ?? "").trim().slice(0, 120) || null,
  });

  const details = answers.filter((a) => a.id !== "name" && a.id !== "email" && a.id !== phoneField?.id).map((a) => `${a.label}: ${a.value}`);
  await addInteraction(contact.id, "note", [`Respondeu ao formulário “${form.name}”.`, ...details].join("\n"));

  if (form.createDeal) {
    const [stage] = await db.select({ id: pipelineStages.id }).from(pipelineStages).orderBy(asc(pipelineStages.order), asc(pipelineStages.id)).limit(1);
    const [open] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.contactId, contact.id), eq(deals.outcome, "open"))).limit(1);
    if (stage && !open) await db.insert(deals).values({ contactId: contact.id, stageId: stage.id, title: `${name} · ${form.name}` });
  }

  if (form.notify) {
    await notifyTeam("leadAdmin", (to, appUrl) =>
      leadNotificationEmail(
        { name, email, phone, subject: form.name, message: details.join("\n"), tag: form.tag || form.name, contactId: contact.id, isNew: created },
        to,
        appUrl
      )
    );
  }
  if (form.autoReply && form.autoReplySubject && form.autoReplyText) {
    try {
      const first = name.split(/\s+/)[0];
      const mail = await getEmailConfig();
      await sendEmail(
        formAutoReplyEmail(
          { to: email, subject: form.autoReplySubject.replaceAll("{nome}", first), text: form.autoReplyText.replaceAll("{nome}", first) },
          mail.notifyEmail
        )
      );
    } catch (e) {
      console.error("[email] resposta automática do formulário falhou:", e);
    }
  }
  refresh(form.id);
  if (created) revalidatePath("/admin/contactos");
  return { ok: true };
}

/** Conta uma visita para a taxa de conversão (as visitas da equipa não contam). */
export async function countFormView(formId: number) {
  if (!(await allow("form-view", 60, 10 * 60_000))) return;
  const user = await getSessionUser();
  if (user && user.role !== "student") return;
  await db.update(forms).set({ views: sql`${forms.views} + 1` }).where(eq(forms.id, Number(formId) || 0));
}

/* ------------------------------ BACKOFFICE ------------------------------- */

export async function createForm(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Dê um nome ao formulário." };
  const [row] = await db
    .insert(forms)
    .values({
      slug: await freeSlug(name),
      name,
      title: name,
      fields: starterFields(),
      successTitle: "Recebido.",
      successText: "Obrigada pelo contacto. Respondo em breve.",
      tag: name.slice(0, 60),
    })
    .returning({ id: forms.id });
  refresh();
  return { ok: true, id: row.id };
}

export async function saveFormContent(
  id: number,
  input: { kicker: string; title: string; description: string; button: string; fields: FormField[] }
): Promise<FormResult> {
  await requireAdmin();
  const clean = cleanFields(input.fields);
  if ("error" in clean) return { ok: false, error: clean.error };
  const title = String(input.title ?? "").trim().slice(0, 200);
  const button = String(input.button ?? "").trim().slice(0, 60);
  if (!title) return { ok: false, error: "Indique o título da página." };
  if (!button) return { ok: false, error: "Indique o texto do botão." };
  await db
    .update(forms)
    .set({
      kicker: String(input.kicker ?? "").trim().slice(0, 60),
      title,
      description: String(input.description ?? "").trim().slice(0, 1000),
      button,
      fields: clean.fields,
      updatedAt: new Date(),
    })
    .where(eq(forms.id, id));
  refresh(id);
  revalidatePath("/contato");
  return { ok: true };
}

export async function saveFormSettings(id: number, _prev: FormResult | null, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const [form] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  if (!form) return { ok: false, error: "Formulário não encontrado." };
  const str = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const on = (k: string) => fd.get(k) === "1";

  const name = str("name", 120);
  if (!name) return { ok: false, error: "Indique o nome do formulário." };
  const slug = form.key ? form.slug : slugify(str("slug", 60));
  if (!slug) return { ok: false, error: "Indique o endereço do formulário." };
  if (slug !== form.slug) {
    const [taken] = await db.select({ id: forms.id }).from(forms).where(eq(forms.slug, slug)).limit(1);
    if (taken) return { ok: false, error: "Já existe um formulário com esse endereço." };
  }
  const successTitle = str("successTitle", 200);
  if (!successTitle) return { ok: false, error: "Indique o título da mensagem de sucesso." };
  const successCtaHref = str("successCtaHref", 500);
  if (successCtaHref && !/^(\/(?![/\\])|https?:\/\/)/.test(successCtaHref)) {
    return { ok: false, error: "O link do botão tem de começar por / ou https://." };
  }
  const autoReply = on("autoReply");
  const autoReplySubject = str("autoReplySubject", 200);
  const autoReplyText = str("autoReplyText", 5000);
  if (autoReply && (!autoReplySubject || !autoReplyText)) return { ok: false, error: "Escreva o assunto e o texto da resposta automática." };

  await db
    .update(forms)
    .set({
      name,
      slug,
      successTitle,
      successText: str("successText", 1000),
      successCtaLabel: str("successCtaLabel", 80),
      successCtaHref,
      tag: str("tag", 60) || null,
      channelId: Number(fd.get("channelId")) || null,
      createDeal: on("createDeal"),
      notify: on("notify"),
      autoReply,
      autoReplySubject,
      autoReplyText,
      active: form.key ? true : on("active"),
      updatedAt: new Date(),
    })
    .where(eq(forms.id, id));
  refresh(id);
  revalidatePath(formPath({ key: form.key, slug }));
  return { ok: true };
}

export async function duplicateForm(id: number): Promise<FormResult> {
  await requireAdmin();
  const [f] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  if (!f) return { ok: false, error: "Formulário não encontrado." };
  const name = `${f.name} (cópia)`.slice(0, 120);
  const { id: _id, key: _key, views: _views, createdAt: _c, updatedAt: _u, ...copy } = f;
  const [row] = await db
    .insert(forms)
    .values({ ...copy, name, slug: await freeSlug(name), active: false })
    .returning({ id: forms.id });
  refresh();
  return { ok: true, id: row.id };
}

export async function toggleForm(id: number) {
  await requireAdmin();
  await db.update(forms).set({ active: sql`not ${forms.active}` }).where(and(eq(forms.id, id), sql`${forms.key} is null`));
  refresh(id);
}

export async function deleteForm(id: number): Promise<FormResult> {
  await requireAdmin();
  const [f] = await db.select({ key: forms.key }).from(forms).where(eq(forms.id, id)).limit(1);
  if (f?.key) return { ok: false, error: "O formulário da página Contacto não pode ser apagado." };
  await db.delete(forms).where(eq(forms.id, id));
  refresh();
  return { ok: true };
}

export async function setSubmissionStatus(id: number, status: "new" | "read" | "archived") {
  await requireAdmin();
  if (!["new", "read", "archived"].includes(status)) return;
  const [row] = await db.update(formSubmissions).set({ status }).where(eq(formSubmissions.id, id)).returning({ formId: formSubmissions.formId });
  if (row) refresh(row.formId);
}

export async function markAllRead(formId: number) {
  await requireAdmin();
  await db.update(formSubmissions).set({ status: "read" }).where(and(eq(formSubmissions.formId, formId), eq(formSubmissions.status, "new")));
  refresh(formId);
}

export async function deleteSubmission(id: number) {
  await requireAdmin();
  const [row] = await db.delete(formSubmissions).where(eq(formSubmissions.id, id)).returning({ formId: formSubmissions.formId });
  if (row) refresh(row.formId);
}
