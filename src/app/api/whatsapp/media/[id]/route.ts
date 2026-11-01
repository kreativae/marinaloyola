import fs from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { ensureWhatsappMedia } from "@/lib/whatsapp";
import { fileHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Foto, áudio, vídeo ou documento de uma mensagem de WhatsApp, só para a equipa.
 * Na primeira vez é pedido à Evolution e guardado; ?dl=1 descarrega em vez de abrir.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role === "student") return new Response("Sem acesso", { status: 401 });
  const { id } = await params;

  let media: Awaited<ReturnType<typeof ensureWhatsappMedia>>;
  try {
    media = await ensureWhatsappMedia(Number(id) || 0);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Não foi possível obter o ficheiro.", { status: 502 });
  }
  if (!media) return new Response("Ficheiro indisponível", { status: 404 });

  const data = await fs.readFile(media.file);
  const download = new URL(req.url).searchParams.get("dl") === "1";
  return new Response(new Uint8Array(data), {
    headers: {
      // O tipo vem de quem enviou a mensagem: HTML, SVG e afins são sempre descarregados
      ...fileHeaders(media.mime, media.name, !download),
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
