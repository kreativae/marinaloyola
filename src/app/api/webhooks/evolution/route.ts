import { NextResponse } from "next/server";
import { getEvolutionConfig } from "@/lib/evolution";
import { recordWhatsappMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Webhook da Evolution API — registado automaticamente ao ligar o WhatsApp em /admin/whatsapp.
 * Eventos tratados: messages.upsert (mensagens recebidas e enviadas pelo telemóvel).
 */

type WaMessage = {
  key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: Record<string, unknown> | null;
  messageTimestamp?: number | string;
};

function textOf(message: Record<string, unknown> | null | undefined): string | null {
  if (!message) return null;
  const m = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { fileName?: string };
    audioMessage?: unknown;
    stickerMessage?: unknown;
    locationMessage?: unknown;
    contactMessage?: { displayName?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string };
    listResponseMessage?: { title?: string };
  };
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    (m.imageMessage ? `📷 Imagem${m.imageMessage.caption ? `: ${m.imageMessage.caption}` : ""}` : null) ||
    (m.videoMessage ? `🎬 Vídeo${m.videoMessage.caption ? `: ${m.videoMessage.caption}` : ""}` : null) ||
    (m.documentMessage ? `📎 ${m.documentMessage.fileName ?? "Documento"}` : null) ||
    (m.audioMessage ? "🎤 Mensagem de voz" : null) ||
    (m.stickerMessage ? "Sticker" : null) ||
    (m.locationMessage ? "📍 Localização" : null) ||
    (m.contactMessage ? `👤 Contacto: ${m.contactMessage.displayName ?? ""}` : null) ||
    null
  );
}

export async function POST(req: Request) {
  const config = await getEvolutionConfig();
  const token = new URL(req.url).searchParams.get("token");
  if (token !== config.webhookToken) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { event?: string; data?: WaMessage | WaMessage[] | { messages?: WaMessage[] } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const event = String(body.event ?? "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return NextResponse.json({ ok: true, ignored: event });

  const raw = body.data;
  const list: WaMessage[] = Array.isArray(raw)
    ? raw
    : raw && "messages" in raw && Array.isArray(raw.messages)
      ? raw.messages
      : raw
        ? [raw as WaMessage]
        : [];

  let saved = 0;
  for (const msg of list) {
    // Prefere o JID com número de telefone quando o WhatsApp usa identificadores LID
    const jid = [msg.key?.remoteJid, msg.key?.remoteJidAlt].find((j) => j?.endsWith("@s.whatsapp.net"));
    if (!jid) continue; // grupos, estados, newsletters
    const text = textOf(msg.message);
    if (!text) continue;
    const ts = Number(msg.messageTimestamp);
    await recordWhatsappMessage({
      digits: jid.split("@")[0].split(":")[0],
      pushName: msg.pushName,
      body: text,
      fromMe: Boolean(msg.key?.fromMe),
      waMessageId: msg.key?.id ?? null,
      at: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : undefined,
    });
    saved++;
  }

  return NextResponse.json({ ok: true, saved });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "evolution-webhook", accept: "POST" });
}
