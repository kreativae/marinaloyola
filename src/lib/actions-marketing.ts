"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { POST_STATUS } from "@/lib/utils";

export type PostResult = { ok: boolean; error?: string };
type PostStatus = (typeof posts.$inferSelect)["status"];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// "AAAA-MM-DDTHH:MM" do formulário, na hora de Lisboa (o fuso do servidor)
const localDate = (v: string) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** Cria (id null) ou actualiza um conteúdo. */
export async function savePostAction(id: number | null, _prev: PostResult | null, fd: FormData): Promise<PostResult> {
  await requireAdmin();
  const title = str(fd, "title");
  if (!title) return { ok: false, error: "Indique o tema ou título." };
  const statusRaw = str(fd, "status");
  const values = {
    title,
    network: str(fd, "network") || "Instagram",
    format: str(fd, "format") || "Carrossel",
    status: (statusRaw in POST_STATUS ? statusRaw : "idea") as PostStatus,
    publishAt: localDate(str(fd, "publishAt")),
    copy: str(fd, "copy") || null,
    hashtags: str(fd, "hashtags") || null,
    link: str(fd, "link") || null,
    notes: str(fd, "notes") || null,
  };
  if (id) await db.update(posts).set(values).where(eq(posts.id, id));
  else await db.insert(posts).values(values);
  revalidatePath("/admin/marketing");
  return { ok: true };
}

export async function duplicatePost(id: number) {
  await requireAdmin();
  const [p] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!p) return;
  const { id: _, createdAt: __, ...rest } = p;
  void _;
  void __;
  await db.insert(posts).values({ ...rest, title: `${p.title} (cópia)`, status: "idea", publishAt: null });
  revalidatePath("/admin/marketing");
}

/** Arrastar no calendário: muda o dia e mantém a hora (10:00 se ainda não tinha). */
export async function reschedulePost(id: number, day: string) {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const [p] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!p) return;
  const [y, m, d] = day.split("-").map(Number);
  const h = p.publishAt ? p.publishAt.getHours() : 10;
  const min = p.publishAt ? p.publishAt.getMinutes() : 0;
  await db.update(posts).set({ publishAt: new Date(y, m - 1, d, h, min) }).where(eq(posts.id, id));
  revalidatePath("/admin/marketing");
}
