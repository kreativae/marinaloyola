import crypto from "node:crypto";

/** Compara segredos (tokens de webhooks) sem revelar pelo tempo de resposta quantos caracteres acertaram. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

/** Tipos que o browser pode abrir sem risco; tudo o resto (HTML, SVG, scripts…) é sempre descarregado. */
const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|avif|heic|heif)|video\/(mp4|webm|quicktime|3gpp)|audio\/[\w.+-]+|application\/pdf|text\/plain)$/;

/**
 * Cabeçalhos para servir um ficheiro enviado por terceiros (anexos, WhatsApp, comprovativos).
 * Um ficheiro HTML aberto no domínio da plataforma podia correr código com a sessão de quem o abre.
 */
export function fileHeaders(mime: string | null | undefined, name: string, wantInline: boolean) {
  const type = (mime ?? "").split(";")[0].trim().toLowerCase();
  const inline = wantInline && INLINE_SAFE.test(type);
  const headers: Record<string, string> = {
    "Content-Type": INLINE_SAFE.test(type) ? type : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    "X-Content-Type-Options": "nosniff",
  };
  // O leitor de PDF do Chrome não abre com sandbox; os restantes tipos ficam isolados
  if (type !== "application/pdf") {
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";
  }
  return headers;
}

/**
 * Célula de CSV. Um valor começado por = + - @ seria executado como fórmula ao abrir no Excel
 * (um lead podia escrever =HYPERLINK(...) no nome), por isso leva um apóstrofo à frente.
 */
export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  // Telefones (+351…) e valores negativos ficam como estão
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().,-]*$/.test(s))) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
