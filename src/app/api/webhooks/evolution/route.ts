import { NextResponse } from "next/server";
import { getEvolutionConfig } from "@/lib/evolution";
import { recordWhatsappMessage } from "@/lib/whatsapp";
import { safeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Webhook da Evolution API — registado automaticamente ao ligar o WhatsApp em /admin/whatsapp.
 * Eventos tratados: messages.upsert (mensagens recebidas e enviadas pelo telemóvel).
 * Fotos, áudios e documentos não são descarregados aqui: guarda-se só a referência.
 */

type WaMessage = {
  key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: Record<string, unknown> | null;
  messageTimestamp?: number | string;
};

type Media = { caption?: string; mimetype?: string; fileName?: string; fileLength?: number | string; seconds?: number };
type Parsed = {
  kind: string;
  body: string;
  media?: { mime: string | null; name: string | null; size: number | null; seconds: number | null };
};

/** Tira os invólucros (mensagens temporárias, ver uma vez, documento com legenda). */
function unwrap(message: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  let m = message ?? null;
  for (let i = 0; i < 4 && m; i++) {
    const inner =
      (m.ephemeralMessage as { message?: Record<string, unknown> })?.message ??
      (m.viewOnceMessage as { message?: Record<string, unknown> })?.message ??
      (m.viewOnceMessageV2 as { message?: Record<string, unknown> })?.message ??
      (m.documentWithCaptionMessage as { message?: Record<string, unknown> })?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function parse(message: Record<string, unknown> | null): Parsed | null {
  if (!message) return null;
  const m = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: Media;
    videoMessage?: Media;
    documentMessage?: Media;
    audioMessage?: Media;
    stickerMessage?: Media;
    locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string };
    contactMessage?: { displayName?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string };
    listResponseMessage?: { title?: string };
  };
  const text = m.conversation || m.extendedTextMessage?.text || m.buttonsResponseMessage?.selectedDisplayText || m.listResponseMessage?.title;
  if (text) return { kind: "text", body: text };

  const media = (kind: string, x: Media): Parsed => ({
    kind,
    body: x.caption ?? "",
    media: {
      mime: x.mimetype?.split(";")[0] ?? null,
      name: x.fileName ?? null,
      size: Number(x.fileLength) || null,
      seconds: x.seconds ?? null,
    },
  });
  if (m.imageMessage) return media("image", m.imageMessage);
  if (m.videoMessage) return media("video", m.videoMessage);
  if (m.audioMessage) return media("audio", m.audioMessage);
  if (m.documentMessage) return media("document", m.documentMessage);
  if (m.stickerMessage) return media("sticker", m.stickerMessage);
  if (m.locationMessage) {
    const { degreesLatitude: lat, degreesLongitude: lng, name } = m.locationMessage;
    return { kind: "location", body: lat != null && lng != null ? `${name ? `${name}\n` : ""}https://maps.google.com/?q=${lat},${lng}` : "Localização" };
  }
  if (m.contactMessage) return { kind: "contact", body: m.contactMessage.displayName ?? "Contacto" };
  return null;
}

export async function POST(req: Request) {
  const config = await getEvolutionConfig();
  const token = new URL(req.url).searchParams.get("token");
  if (!safeEqual(token, config.webhookToken)) {
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
    const content = unwrap(msg.message);
    const parsed = parse(content);
    if (!parsed) continue;
    const ts = Number(msg.messageTimestamp);
    await recordWhatsappMessage({
      digits: jid.split("@")[0].split(":")[0],
      pushName: msg.pushName,
      body: parsed.body,
      kind: parsed.kind,
      media: parsed.media,
      // Guardado para pedir o ficheiro à Evolution só quando alguém o quiser ver
      raw: parsed.media && msg.key && content ? { key: msg.key, message: content } : null,
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
