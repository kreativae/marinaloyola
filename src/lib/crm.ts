import { eq } from "drizzle-orm";
import { db } from "@/db";
import { countryOfTz, inferFromPhone, isValidTz } from "@/lib/timezones";
import { contacts, contactTags, interactions, tags, type Contact } from "@/db/schema";

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
  const [existing] = await db.select().from(contacts).where(eq(contacts.email, email)).limit(1);
  if (existing) {
    const patch: Partial<Contact> = {};
    if (data.phone && !existing.phone) patch.phone = data.phone;
    if (!existing.timezone && locale) Object.assign(patch, locale);
    if (Object.keys(patch).length) {
      await db.update(contacts).set(patch).where(eq(contacts.id, existing.id));
      Object.assign(existing, patch);
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
