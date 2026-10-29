import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, whatsappMessages, type Contact } from "@/db/schema";
import { addInteraction, localeFor, tagContact } from "@/lib/crm";
import { getEvolutionConfig, isConfigured, normalizePhone, sendText } from "@/lib/evolution";
import { getSetting, isOn } from "@/lib/settings";

const digitsOf = sql`regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g')`;

/** Procura o contacto pelo número (exacto, ou pelos últimos 9 dígitos para tolerar indicativos). */
export async function findContactByPhone(digits: string): Promise<Contact | null> {
  const [exact] = await db.select().from(contacts).where(sql`${digitsOf} = ${digits}`).limit(1);
  if (exact) return exact;
  const tail = digits.slice(-9);
  const [byTail] = await db
    .select()
    .from(contacts)
    .where(sql`right(${digitsOf}, 9) = ${tail}`)
    .limit(1);
  return byTail ?? null;
}

/** Mensagem recebida (ou enviada pelo telemóvel): cria o lead se for um número novo. */
export async function recordWhatsappMessage(data: {
  digits: string;
  pushName?: string | null;
  body: string;
  fromMe: boolean;
  waMessageId: string | null;
  at?: Date;
}) {
  if (data.waMessageId) {
    const [dup] = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.waMessageId, data.waMessageId))
      .limit(1);
    if (dup) return;
  }

  let contact = await findContactByPhone(data.digits);
  if (!contact) {
    if (data.fromMe) return; // mensagem nossa para alguém fora do CRM
    if (!isOn(await getSetting("wa_auto_lead"))) return; // leads automáticos desligados
    [contact] = await db
      .insert(contacts)
      .values({
        name: data.pushName?.trim() || `+${data.digits}`,
        phone: `+${data.digits}`,
        source: "whatsapp",
        ...localeFor(`+${data.digits}`),
      })
      .returning();
    await tagContact(contact.id, "WhatsApp", "#25d366");
    await addInteraction(contact.id, "system", "Novo lead criado a partir de uma mensagem de WhatsApp.");
  }

  await db.insert(whatsappMessages).values({
    contactId: contact.id,
    direction: data.fromMe ? "out" : "in",
    body: data.body,
    waMessageId: data.waMessageId,
    readAt: data.fromMe ? new Date() : null,
    createdAt: data.at ?? new Date(),
  });
}

/** Envia uma mensagem a um contacto via Evolution e guarda-a na conversa. */
export async function sendWhatsappToContact(contact: Contact, text: string) {
  const number = normalizePhone(contact.phone);
  if (!number) throw new Error("Este contacto não tem um número de telemóvel válido.");
  const config = await getEvolutionConfig();
  if (!isConfigured(config)) throw new Error("WhatsApp não está ligado. Configure a Evolution API.");
  const { id } = await sendText(config, number, text);
  await db
    .insert(whatsappMessages)
    .values({ contactId: contact.id, direction: "out", body: text, waMessageId: id, readAt: new Date() })
    .onConflictDoNothing();
}
