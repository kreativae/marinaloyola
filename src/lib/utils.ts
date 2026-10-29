export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------ FORMATAÇÃO ------------------------------ */

/**
 * Números à portuguesa com ponto nos milhares e vírgula nas décimas: 4.501,00.
 * Feito à mão (sem Intl) porque o pt-PT do Intl usa espaço como separador e não agrupa
 * números de 4 dígitos (4501), e o resultado tem de ser igual no servidor e no browser.
 */
export function num(n: number | string | null | undefined, decimals = 0) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  const [int, frac] = Math.abs(v).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 && Number(Math.abs(v).toFixed(decimals)) !== 0 ? "-" : ""}${grouped}${frac ? `,${frac}` : ""}`;
}

export const eur = (n: number | string | null | undefined) => `${num(n, 2)}\u00a0€`;

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function weekdayLabel(dow: number) {
  return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][dow] ?? "";
}

/* ---------------------------- LABELS / CORES ---------------------------- */

export const CONTACT_STATUS: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-sky-500/10 text-sky-700 border-sky-500/30" },
  qualified: { label: "Qualificado", className: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  negotiating: { label: "Em negociação", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  client: { label: "Cliente", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  inactive: { label: "Inativo", className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30" },
  lost: { label: "Perdido", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
};

export const SOURCES: Record<string, string> = {
  whatsapp: "WhatsApp",
  hotmart: "Hotmart",
  site: "Site",
  social: "Redes sociais",
  referral: "Indicação",
  manual: "Manual",
};

export const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  confirmed: { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  completed: { label: "Concluído", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  refunded: { label: "Reembolsado", className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30" },
  cancelled: { label: "Cancelado", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
};

export const PAYMENT_METHODS: Record<string, string> = {
  hotmart: "Hotmart",
  mbway: "MBWay",
  transfer: "Transferência",
  other: "Outro",
};

export const POST_STATUS: Record<string, string> = {
  idea: "Ideia",
  production: "Em produção",
  review: "Em revisão",
  approved: "Aprovado",
  published: "Publicado",
};

export const APPT_STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  cancelled: { label: "Cancelado", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  rescheduled: { label: "Reagendado", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  completed: { label: "Realizado", className: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30" },
};

export const LESSON_TYPES: Record<string, string> = {
  video: "Vídeo",
  material: "Material",
  quiz: "Quiz",
};

export const INTERACTION_ICONS: Record<string, string> = {
  note: "Nota",
  whatsapp: "WhatsApp",
  email: "Email",
  purchase: "Compra",
  booking: "Agendamento",
  system: "Sistema",
};

/** Substitui {variavel} pelo valor correspondente; variáveis desconhecidas ficam como estão. */
export const fillTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
