import { eq } from "drizzle-orm";
import { db } from "@/db";
import { countryOfTz, inferFromPhone, isValidTz } from "@/lib/timezones";
import { contacts, contactTags, interactions, tags, type Contact } from "@/db/schema";
import { cleanEmail, compatible, nameIsPhone, samePhone } from "@/lib/contacts-def";
import { matchContacts, mergeContacts } from "@/lib/contacts-merge";

type Source = "whatsapp" | "hotmart" | "site" | "social" | "referral" | "manual";

export async function ensureTag(name: string, color = "#800080") {
  const [existing] = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(tags).values({ name, color }).returning({ id: tags.id });
  return created.id;
}

export async function attachTag(contactId: number, tagId: number) {
  await db.insert(contactTags).values({ contactId, tagId }).onConflictDoNothing();
}

export async function tagContact(contactId: number, name: string, color?: string) {
  await attachTag(contactId, await ensureTag(name, color));
}

export async function addInteraction(contactId: number, type: string, content: string) {
  await db.insert(interactions).values({ contactId, type, content });
}

export async function findOrCreateContact(data: {
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  source: Source;
  /** Fuso detectado (ex: no browser ao agendar); senão deduz-se do telefone */
  timezone?: string | null;
}): Promise<{ contact: Contact; created: boolean }> {
  const email = data.email.trim().toLowerCase();
  const locale = localeFor(data.phone, data.timezone);
  const matches = await matchContacts(email, data.phone);
  if (matches.length) {
    let existing = matches.find((c) => cleanEmail(c.email) === email) ?? matches[0];
    // Email num contacto e telefone noutro: é a mesma pessoa, desde que os dados não se contradigam
    for (const other of matches) {
      if (other.id === existing.id || !compatible(existing, other)) continue;
      existing = (await mergeContacts(existing.id, other.id, { auto: true })) ?? existing;
    }
    const patch: Partial<Contact> = {};
    if (!existing.email) patch.email = email;
    if (data.phone && !existing.phone) patch.phone = data.phone;
    if (nameIsPhone(existing.name) && data.name.trim()) patch.name = data.name.trim();
    if (!existing.timezone && locale) Object.assign(patch, locale);
    if (Object.keys(patch).length) {
      await db.update(contacts).set(patch).where(eq(contacts.id, existing.id));
      Object.assign(existing, patch);
    }
    // Dados diferentes dos da ficha ficam no histórico, para a equipa decidir
    if (cleanEmail(existing.email) !== email) await addInteraction(existing.id, "system", `Indicou outro email: ${email}.`);
    if (data.phone && !samePhone(existing.phone, data.phone)) {
      await addInteraction(existing.id, "system", `Indicou outro telefone: ${data.phone}.`);
    }
    return { contact: existing, created: false };
  }
  const [contact] = await db
    .insert(contacts)
    .values({
      name: data.name.trim(),
      email,
      phone: data.phone ?? null,
      location: data.location ?? null,
      source: data.source,
      ...locale,
    })
    .returning();
  return { contact, created: true };
}

/** País e fuso de um contacto: o fuso detectado tem prioridade sobre o indicativo do telefone. */
export function localeFor(phone: string | null | undefined, timezone?: string | null) {
  if (isValidTz(timezone)) {
    return { timezone, country: countryOfTz(timezone) ?? inferFromPhone(phone)?.country ?? null };
  }
  return inferFromPhone(phone);
}
