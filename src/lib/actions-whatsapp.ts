"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contacts, whatsappMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  connect,
  connectionState,
  deleteForEveryone,
  getEvolutionConfig,
  isConfigured,
  logout,
  normalizePhone,
  type ConnectionState,
} from "@/lib/evolution";
import { filePath } from "@/lib/files";
import { sendWhatsappFile, sendWhatsappToContact } from "@/lib/whatsapp";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function getWhatsappStatus(): Promise<{ state: ConnectionState; error?: string }> {
  await requireAdmin();
  const config = await getEvolutionConfig();
  if (!isConfigured(config)) return { state: "unknown", error: "Evolution API não configurada." };
  try {
    return { state: await connectionState(config) };
  } catch (e) {
    return { state: "unknown", error: errMsg(e) };
  }
}

export async function connectWhatsapp(): Promise<{
  state: ConnectionState;
  qr?: string | null;
  error?: string;
}> {
  await requireAdmin();
  try {
    return await connect(await getEvolutionConfig());
  } catch (e) {
    return { state: "unknown", error: errMsg(e) };
  }
}

export async function disconnectWhatsapp(): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await logout(await getEvolutionConfig());
    revalidatePath("/admin/whatsapp");
    return {};
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function sendWhatsappMessage(
  contactId: number,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const body = text.trim();
  if (!body) return { ok: false, error: "Mensagem vazia." };
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) return { ok: false, error: "Contacto não encontrado." };
  try {
    await sendWhatsappToContact(contact, body);
    revalidatePath("/admin/whatsapp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function markConversationRead(contactId: number) {
  await requireAdmin();
  await db
    .update(whatsappMessages)
    .set({ readAt: new Date() })
    .where(and(eq(whatsappMessages.contactId, contactId), isNull(whatsappMessages.readAt)));
}

/** Foto, vídeo, documento ou áudio (campo "voice" = 1 quando foi gravado no browser). */
export async function sendWhatsappFileAction(contactId: number, fd: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha um ficheiro." };
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) return { ok: false, error: "Contacto não encontrado." };
  try {
    await sendWhatsappFile(contact, file, String(fd.get("caption") ?? "").trim(), fd.get("voice") === "1");
    revalidatePath("/admin/whatsapp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Apaga uma mensagem da conversa na plataforma. Com forEveryone (só mensagens enviadas por nós),
 * apaga-a também no WhatsApp da pessoa.
 */
export async function deleteWhatsappMessage(id: number, forEveryone: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const [m] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id)).limit(1);
  if (!m) return { ok: true };
  if (forEveryone) {
    if (m.direction !== "out" || !m.waMessageId) return { ok: false, error: "Só as mensagens enviadas por si podem ser apagadas para todos." };
    const [contact] = await db.select({ phone: contacts.phone }).from(contacts).where(eq(contacts.id, m.contactId)).limit(1);
    const number = normalizePhone(contact?.phone);
    if (!number) return { ok: false, error: "O contacto não tem número válido." };
    try {
      await deleteForEveryone(await getEvolutionConfig(), number, m.waMessageId);
    } catch (e) {
      return { ok: false, error: `O WhatsApp não apagou a mensagem: ${errMsg(e)}` };
    }
  }
  await db.delete(whatsappMessages).where(eq(whatsappMessages.id, id));
  if (m.mediaFile) await fs.rm(filePath(m.mediaFile, "whatsapp"), { force: true });
  revalidatePath("/admin/whatsapp");
  return { ok: true };
}

export async function renameWhatsappContact(contactId: number, name: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!clean) return { ok: false, error: "Indique o nome." };
  await db.update(contacts).set({ name: clean }).where(eq(contacts.id, contactId));
  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/contactos");
  revalidatePath(`/admin/crm/${contactId}`);
  return { ok: true };
}
