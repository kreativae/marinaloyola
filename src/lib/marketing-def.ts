/** Constantes do marketing, partilhadas entre a página (servidor) e o editor (browser). */

export const STATUS_COLORS: Record<string, string> = {
  idea: "#a1a1aa",
  production: "#0ea5e9",
  review: "#f59e0b",
  approved: "#a855f7",
  published: "#10b981",
};

export const NETWORK_COLORS: Record<string, string> = {
  Instagram: "#c13584",
  Facebook: "#1877f2",
  LinkedIn: "#0a66c2",
  TikTok: "#18181b",
  YouTube: "#ff0000",
  Blog: "#10b981",
  Email: "#f59e0b",
};
export const FORMATS = ["Carrossel", "Reels", "Stories", "Post estático", "Vídeo", "Artigo", "Newsletter"];
// Limite de caracteres da legenda por rede
export const LIMITS: Record<string, number> = { Instagram: 2200, TikTok: 2200, LinkedIn: 3000, Facebook: 63206, YouTube: 5000 };

