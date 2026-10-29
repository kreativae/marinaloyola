import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bioLinks, courses, eventTypes } from "@/db/schema";
import { getAvailableSlots } from "@/lib/actions";
import { getSettings, readRaw } from "@/lib/settings";

/**
 * Página de links (link na bio do Instagram): textos e secções vêm das settings `bio_*`,
 * os links personalizados da tabela bio_links. Todos os cliques passam por /links/ir/<destino>,
 * que conta o clique e redirecciona apenas para destinos conhecidos (sem redireccionamento aberto).
 */

export const BIO_DEFAULTS = {
  bio_name: "Marina Loyola",
  bio_tagline: "Design com estratégia. Marcas com alma.",
  bio_about: "Mentora de designers e directora criativa. Ajudo-te a posicionar a tua marca e a cobrar o que vales.",
  bio_photo: "/img/marina-hero.jpg",
  bio_instagram: "marinaloyola",
  bio_show_booking: "1",
  bio_show_courses: "1",
  bio_show_newsletter: "1",
  bio_booking_title: "Agendar uma sessão",
  bio_booking_subtitle: "Sessão exploratória gratuita de 30 minutos, por videochamada.",
} as const;
export type BioKey = keyof typeof BIO_DEFAULTS;
export const BIO_KEYS = Object.keys(BIO_DEFAULTS) as BioKey[];

export async function getBioConfig() {
  const raw = await readRaw(BIO_KEYS);
  const extra = await getSettings(["whatsapp_number", "contact_email"]);
  const cfg = Object.fromEntries(BIO_KEYS.map((k) => [k, raw[k] ?? BIO_DEFAULTS[k]])) as Record<BioKey, string>;
  return { ...cfg, whatsapp: extra.whatsapp_number, email: extra.contact_email };
}

export async function activeLinks() {
  return db.select().from(bioLinks).where(eq(bioLinks.active, true)).orderBy(asc(bioLinks.order), asc(bioLinks.id));
}

export async function publishedCourses() {
  return db.select().from(courses).where(eq(courses.published, true)).orderBy(asc(courses.createdAt));
}

/** Destino de um clique. Devolve null para destinos desconhecidos. */
export async function resolveTarget(target: string): Promise<string | null> {
  const cfg = await getBioConfig();
  const utm = "utm_source=instagram&utm_medium=bio";
  if (target === "agendar") return `/agendar?${utm}`;
  if (target === "cursos") return `/cursos?${utm}`;
  if (target === "site") return `/?${utm}`;
  if (target === "whatsapp") {
    return `https://wa.me/${cfg.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá Marina! Vim pelo Instagram 💜")}`;
  }
  if (target === "instagram") return `https://instagram.com/${cfg.bio_instagram.replace(/^@/, "")}`;
  if (target === "email") return `mailto:${cfg.email}`;
  const day = target.match(/^agendar-(\d+)-(\d{4}-\d{2}-\d{2})$/);
  if (day) return `/agendar?tipo=${day[1]}&data=${day[2]}&${utm}`;
  const course = target.match(/^c(\d+)$/);
  if (course) {
    const [c] = await db.select().from(courses).where(and(eq(courses.id, Number(course[1])), eq(courses.published, true))).limit(1);
    return c ? c.hotmartUrl || `/cursos?${utm}#${c.slug}` : null;
  }
  const link = target.match(/^l(\d+)$/);
  if (link) {
    const [l] = await db.select().from(bioLinks).where(eq(bioLinks.id, Number(link[1]))).limit(1);
    return l?.active ? l.url : null;
  }
  return null;
}

/** Próximos dias com vagas no tipo de sessão principal (para atalhos de marcação). */
export async function nextBookingDays(max = 4) {
  const [type] = await db.select().from(eventTypes).where(eq(eventTypes.active, true)).orderBy(asc(eventTypes.id)).limit(1);
  if (!type) return { type: null, days: [] as { iso: string; slots: number }[] };
  const days: { iso: string; slots: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 21 && days.length < max; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const slots = await getAvailableSlots(type.id, iso);
    if (slots.length) days.push({ iso, slots: slots.length });
  }
  return { type, days };
}
