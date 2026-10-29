"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { bioLinks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { BIO_DEFAULTS, BIO_KEYS } from "@/lib/bio";
import { saveSettings } from "@/lib/settings";

export type BioResult = { ok: boolean; error?: string; savedAt?: number };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// Destinos aceites: caminhos do próprio site, https, mailto e wa.me
const validUrl = (u: string) => /^(\/[^/]|https?:\/\/|mailto:)/i.test(u);

function refresh() {
  revalidatePath("/links");
  revalidatePath("/admin/links");
}

export async function saveBioProfile(_prev: BioResult | null, fd: FormData): Promise<BioResult> {
  await requireAdmin();
  const values: Record<string, string> = {};
  for (const k of BIO_KEYS) {
    if (k.startsWith("bio_show_")) values[k] = fd.get(k) === "1" ? "1" : "0";
    else values[k] = str(fd, k) || BIO_DEFAULTS[k];
  }
  values.bio_instagram = values.bio_instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
  if (!validUrl(values.bio_photo)) return { ok: false, error: "A foto tem de ser um caminho (/img/…) ou um link https." };
  await saveSettings(values);
  refresh();
  return { ok: true, savedAt: Date.now() };
}

function readLink(fd: FormData) {
  return {
    title: str(fd, "title"),
    subtitle: str(fd, "subtitle") || null,
    url: str(fd, "url"),
    image: str(fd, "image") || null,
    highlight: fd.get("highlight") === "1",
  };
}

export async function saveBioLink(id: number | null, _prev: BioResult | null, fd: FormData): Promise<BioResult> {
  await requireAdmin();
  const l = readLink(fd);
  if (!l.title) return { ok: false, error: "Indique o título." };
  if (!validUrl(l.url)) return { ok: false, error: "O link tem de começar por https://, / ou mailto:." };
  if (l.image && !validUrl(l.image)) return { ok: false, error: "A imagem tem de ser um caminho (/img/…) ou um link https." };
  if (id) {
    await db.update(bioLinks).set(l).where(eq(bioLinks.id, id));
  } else {
    const [last] = await db.select({ order: bioLinks.order }).from(bioLinks).orderBy(desc(bioLinks.order)).limit(1);
    await db.insert(bioLinks).values({ ...l, order: (last?.order ?? 0) + 1 });
  }
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function toggleBioLink(id: number) {
  await requireAdmin();
  const [l] = await db.select().from(bioLinks).where(eq(bioLinks.id, id)).limit(1);
  if (!l) return;
  await db.update(bioLinks).set({ active: !l.active }).where(eq(bioLinks.id, id));
  refresh();
}

export async function deleteBioLink(id: number) {
  await requireAdmin();
  await db.delete(bioLinks).where(eq(bioLinks.id, id));
  refresh();
}

/** Troca a posição com o link vizinho (dir -1 = subir). */
export async function moveBioLink(id: number, dir: -1 | 1) {
  await requireAdmin();
  const [l] = await db.select().from(bioLinks).where(eq(bioLinks.id, id)).limit(1);
  if (!l) return;
  const [other] = await db
    .select()
    .from(bioLinks)
    .where(dir < 0 ? lt(bioLinks.order, l.order) : and(gt(bioLinks.order, l.order)))
    .orderBy(dir < 0 ? desc(bioLinks.order) : asc(bioLinks.order))
    .limit(1);
  if (!other) return;
  await db.update(bioLinks).set({ order: other.order }).where(eq(bioLinks.id, l.id));
  await db.update(bioLinks).set({ order: l.order }).where(eq(bioLinks.id, other.id));
  refresh();
}
