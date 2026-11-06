import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms, type Form } from "@/db/schema";
import { contactFields } from "@/lib/forms-def";
import { getSitePage } from "@/lib/site-content";

/** O que a página pública precisa de saber (sem as regras internas do formulário). */
export type PublicFormData = Pick<Form, "id" | "fields" | "button" | "successTitle" | "successText" | "successCtaLabel" | "successCtaHref">;

export const toPublic = ({ id, fields, button, successTitle, successText, successCtaLabel, successCtaHref }: Form): PublicFormData => ({
  id,
  fields,
  button,
  successTitle,
  successText,
  successCtaLabel,
  successCtaHref,
});

/** O formulário da página Contacto: na primeira vez é criado com o que estava no Site. */
export async function getContactForm(): Promise<Form> {
  const [found] = await db.select().from(forms).where(eq(forms.key, "contato")).limit(1);
  if (found) return found;
  const { form } = (await getSitePage("contato")).s;
  await db
    .insert(forms)
    .values({
      key: "contato",
      slug: "contato",
      name: "Contacto do site",
      kicker: "Contacto",
      title: "Vamos conversar",
      fields: contactFields(form.subjects),
      button: form.button,
      successTitle: form.successTitle,
      successText: form.successText,
      successCtaLabel: "Agendar sessão exploratória",
      successCtaHref: "/agendar",
      tag: "Contacto Site",
    })
    .onConflictDoNothing();
  const [row] = await db.select().from(forms).where(eq(forms.key, "contato")).limit(1);
  return row;
}
