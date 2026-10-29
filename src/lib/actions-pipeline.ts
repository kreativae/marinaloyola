"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, pipelineStages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { addInteraction } from "@/lib/crm";
import { eur } from "@/lib/utils";

export type DealResult = { ok: boolean; error?: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const money = (raw: string) => Number(raw.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
const dateOf = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : null);

function refresh(contactId?: number) {
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin");
  if (contactId) revalidatePath(`/admin/crm/${contactId}`);
}

function readDeal(fd: FormData) {
  return {
    title: str(fd, "title"),
    product: str(fd, "product") || "Mentoria",
    value: money(str(fd, "value")).toFixed(2),
    owner: str(fd, "owner") || "Marina",
    expectedClose: dateOf(str(fd, "expectedClose")),
    notes: str(fd, "notes") || null,
  };
}

export async function createDealAction(_prev: DealResult | null, fd: FormData): Promise<DealResult> {
  await requireAdmin();
  const contactId = Number(fd.get("contactId"));
  const stageId = Number(fd.get("stageId"));
  const d = readDeal(fd);
  if (!contactId) return { ok: false, error: "Escolha o contacto." };
  if (!d.title) return { ok: false, error: "Dê um título ao negócio." };
  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
  if (!stage) return { ok: false, error: "Escolha a fase." };
  const [contact] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) return { ok: false, error: "Contacto não encontrado." };
  await db.insert(deals).values({ contactId, stageId, ...d });
  await addInteraction(contactId, "system", `Negócio criado no pipeline: "${d.title}" (${d.product}, ${eur(d.value)}).`);
  refresh(contactId);
  return { ok: true };
}

export async function updateDealAction(id: number, _prev: DealResult | null, fd: FormData): Promise<DealResult> {
  await requireAdmin();
  const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (!deal) return { ok: false, error: "Negócio não encontrado." };
  const d = readDeal(fd);
  if (!d.title) return { ok: false, error: "Dê um título ao negócio." };
  const stageId = Number(fd.get("stageId")) || deal.stageId;
  await db.update(deals).set({ ...d, stageId, updatedAt: new Date() }).where(eq(deals.id, id));
  if (stageId !== deal.stageId) {
    const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
    if (stage) await addInteraction(deal.contactId, "system", `Pipeline: "${d.title}" movido para "${stage.name}".`);
  }
  refresh(deal.contactId);
  return { ok: true };
}

/** Fecha (ganho/perdido) ou reabre um negócio. Ganhar marca o contacto como cliente. */
export async function setDealOutcome(id: number, outcome: "open" | "won" | "lost", reason?: string) {
  await requireAdmin();
  const [deal] = await db
    .update(deals)
    .set({
      outcome,
      closedAt: outcome === "open" ? null : new Date(),
      lostReason: outcome === "lost" ? reason?.trim() || null : null,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, id))
    .returning();
  if (!deal) return;
  if (outcome === "won") {
    await db.update(contacts).set({ status: "client" }).where(eq(contacts.id, deal.contactId));
    await addInteraction(deal.contactId, "purchase", `Negócio ganho: "${deal.title}" — ${eur(deal.value)}.`);
  } else if (outcome === "lost") {
    await addInteraction(deal.contactId, "system", `Negócio perdido: "${deal.title}"${reason ? ` — ${reason}` : ""}.`);
  } else {
    await addInteraction(deal.contactId, "system", `Negócio reaberto: "${deal.title}".`);
  }
  refresh(deal.contactId);
}

export async function deleteDeal(id: number) {
  await requireAdmin();
  const [deal] = await db.delete(deals).where(eq(deals.id, id)).returning();
  if (deal) {
    await addInteraction(deal.contactId, "system", `Negócio apagado: "${deal.title}".`);
    refresh(deal.contactId);
  }
}
