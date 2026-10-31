/** Constantes do WhatsApp sem dependências de servidor (usadas também no browser). */

export const WA_KIND_LABEL: Record<string, string> = {
  image: "📷 Foto",
  video: "🎬 Vídeo",
  audio: "🎤 Áudio",
  document: "📎 Documento",
  sticker: "Sticker",
  location: "📍 Localização",
  contact: "👤 Contacto",
};

/** Texto curto de uma mensagem para a lista de conversas. */
export function waPreview(kind: string, body: string, name?: string | null) {
  if (kind === "text") return body;
  const label = kind === "document" && name ? `📎 ${name}` : (WA_KIND_LABEL[kind] ?? "Mensagem");
  return body && kind !== "location" && kind !== "contact" ? `${label}: ${body}` : kind === "contact" ? `👤 ${body}` : label;
}

/** Limites do envio (a Evolution recebe o ficheiro em base64). */
export const WA_MAX_MEDIA = 16_000_000;
export const WA_MAX_DOCUMENT = 45_000_000;
