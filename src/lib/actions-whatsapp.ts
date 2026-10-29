"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contacts, whatsappMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  connect,
  connectionState,
  getEvolutionConfig,
  isConfigured,
  logout,
  type ConnectionState,
} from "@/lib/evolution";
import { sendWhatsappToContact } from "@/lib/whatsapp";

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
