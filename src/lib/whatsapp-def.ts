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

// Cada pessoa tem sempre a mesma cor: encontra-se a conversa pelo olhar
const TONES = [
  "bg-plum/10 text-plum",
  "bg-emerald-500/10 text-emerald-700",
  "bg-sky-500/10 text-sky-700",
  "bg-amber-500/15 text-amber-700",
  "bg-rose-500/10 text-rose-700",
  "bg-violet-500/10 text-violet-700",
  "bg-teal-500/10 text-teal-700",
];
export function avatarTone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
