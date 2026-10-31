import fs from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, whatsappMessages, type Contact } from "@/db/schema";
import { addInteraction, localeFor, tagContact } from "@/lib/crm";
import {
  getEvolutionConfig,
  isConfigured,
  mediaBase64,
  normalizePhone,
  sendAudio,
  sendMedia,
  sendText,
  type EvolutionConfig,
  type MediaType,
} from "@/lib/evolution";
import { filePath, storeBuffer } from "@/lib/files";
import { WA_MAX_DOCUMENT, WA_MAX_MEDIA } from "@/lib/whatsapp-def";
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
  kind?: string;
  media?: { mime: string | null; name: string | null; size: number | null; seconds: number | null };
  raw?: { key: Record<string, unknown>; message: Record<string, unknown> } | null;
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
    kind: data.kind ?? "text",
    mediaMime: data.media?.mime ?? null,
    mediaName: data.media?.name ?? null,
    mediaSize: data.media?.size ?? null,
    mediaSeconds: data.media?.seconds ?? null,
    waRaw: data.raw ?? null,
    waMessageId: data.waMessageId,
    readAt: data.fromMe ? new Date() : null,
    createdAt: data.at ?? new Date(),
  });
}

async function ready(contact: Contact): Promise<{ number: string; config: EvolutionConfig }> {
  const number = normalizePhone(contact.phone);
  if (!number) throw new Error("Este contacto não tem um número de telemóvel válido.");
  const config = await getEvolutionConfig();
  if (!isConfigured(config)) throw new Error("WhatsApp não está ligado. Configure a Evolution API.");
  return { number, config };
}

const extOf = (name: string, mime: string) =>
  path.extname(name).slice(1) || mime.split("/")[1]?.split(";")[0]?.replace("mpeg", "mp3") || "bin";

/**
 * Envia um ficheiro: foto, vídeo, documento ou mensagem de voz (voice = gravada no browser).
 * O ficheiro fica guardado do nosso lado para aparecer logo na conversa.
 */
export async function sendWhatsappFile(contact: Contact, file: File, caption: string, voice: boolean) {
  const { number, config } = await ready(contact);
  const mime = (file.type || "application/octet-stream").split(";")[0];
  const kind = voice || mime.startsWith("audio/") ? "audio" : mime.startsWith("image/") && mime !== "image/svg+xml" ? "image" : mime.startsWith("video/") ? "video" : "document";
  const limit = kind === "document" ? WA_MAX_DOCUMENT : WA_MAX_MEDIA;
  if (file.size > limit) throw new Error(`Ficheiro demasiado grande (máximo ${Math.round(limit / 1_000_000)} MB).`);

  const data = Buffer.from(await file.arrayBuffer());
  const base64 = data.toString("base64");
  const name = file.name || `${kind}.${extOf("", mime)}`;
  const { id } =
    kind === "audio"
      ? await sendAudio(config, number, base64)
      : await sendMedia(config, number, { mediatype: kind as MediaType, mimetype: mime, base64, fileName: name, caption });

  const stored = await storeBuffer(data, extOf(name, mime), "whatsapp");
  await db
    .insert(whatsappMessages)
    .values({
      contactId: contact.id,
      direction: "out",
      body: kind === "audio" ? "" : caption,
      kind,
      mediaMime: mime,
      mediaName: name,
      mediaSize: file.size,
      mediaFile: stored,
      waMessageId: id,
      readAt: new Date(),
    })
    .onConflictDoNothing();
}

/**
 * Ficheiro de uma mensagem, descarregado da Evolution só na primeira vez que alguém o pede
 * (fica depois guardado em uploads/whatsapp). Devolve o caminho no disco e o tipo.
 */
export async function ensureWhatsappMedia(id: number): Promise<{ file: string; mime: string; name: string } | null> {
  const [m] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id)).limit(1);
  if (!m || m.kind === "text") return null;
  if (m.mediaFile) {
    const file = filePath(m.mediaFile, "whatsapp");
    try {
      await fs.access(file);
      return { file, mime: m.mediaMime ?? "application/octet-stream", name: m.mediaName ?? m.mediaFile };
    } catch {
      // ficheiro apagado do disco: volta a pedir à Evolution, se possível
    }
  }
  if (!m.waRaw) return null;
  const config = await getEvolutionConfig();
  if (!isConfigured(config)) throw new Error("WhatsApp não está ligado.");
  const audio = m.kind === "audio";
  const r = await mediaBase64(config, m.waRaw, audio);
  if (!r.base64) throw new Error("A Evolution não devolveu o ficheiro (pode já ter expirado no WhatsApp).");
  const data = Buffer.from(r.base64, "base64");
  const mime = (audio ? "audio/mp4" : r.mimetype || m.mediaMime || "application/octet-stream").split(";")[0];
  const name = m.mediaName || r.fileName || `${m.kind}-${m.id}.${extOf("", mime)}`;
  const stored = await storeBuffer(data, audio ? "m4a" : extOf(name, mime), "whatsapp");
  await db.update(whatsappMessages).set({ mediaFile: stored, mediaMime: mime, mediaSize: data.length }).where(eq(whatsappMessages.id, m.id));
  return { file: filePath(stored, "whatsapp"), mime, name };
}

/** Envia uma mensagem a um contacto via Evolution e guarda-a na conversa. */
export async function sendWhatsappToContact(contact: Contact, text: string) {
  const { number, config } = await ready(contact);
  const { id } = await sendText(config, number, text);
  await db
    .insert(whatsappMessages)
    .values({ contactId: contact.id, direction: "out", body: text, waMessageId: id, readAt: new Date() })
    .onConflictDoNothing();
}
