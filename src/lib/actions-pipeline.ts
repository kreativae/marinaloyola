"use server";

import { revalidatePath } from "next/cache";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, pipelineStages, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { addInteraction } from "@/lib/crm";
import { getPipelines, PIPELINES_KEY, type Pipeline } from "@/lib/pipelines";
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

/* ------------------------- PIPELINES E ETAPAS ------------------------- */

export type StageInput = { id: number | null; name: string; color: string; removed: boolean; moveTo: number | null };
export type PipelineResult = { ok: boolean; error?: string; id?: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A estrutura do pipeline é gerida pela Super Admin e pelo Admin; a Equipa só trabalha nos negócios. */
async function canManagePipelines() {
  const me = await requireAdmin();
  return me.role === "admin" || me.role === "manager";
}

const writePipelines = (tx: Tx, list: Pipeline[]) => {
  const value = JSON.stringify(list);
  return tx.insert(settings).values({ key: PIPELINES_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
};

/** Cria (id null) ou atualiza um pipeline: nome, etapas, ordem, e etapas apagadas com os negócios movidos. */
export async function savePipelineAction(id: string | null, name: string, stages: StageInput[]): Promise<PipelineResult> {
  if (!(await canManagePipelines())) return { ok: false, error: "Sem permissão." };
  const label = name.trim().slice(0, 60);
  const kept = stages.filter((s) => !s.removed).map((s) => ({ ...s, name: s.name.trim().slice(0, 60) }));
  const removed = stages.filter((s) => s.removed && s.id !== null);
  if (!label) return { ok: false, error: "Indique o nome do pipeline." };
  if (!kept.length) return { ok: false, error: "O pipeline precisa de pelo menos uma etapa." };
  if (kept.some((s) => !s.name)) return { ok: false, error: "Todas as etapas precisam de nome." };
  if (kept.some((s) => !/^#[0-9a-f]{6}$/i.test(s.color))) return { ok: false, error: "Cor inválida." };

  const pipelines = await getPipelines();
  if (id && !pipelines.some((p) => p.id === id)) return { ok: false, error: "Pipeline não encontrado." };
  const pipelineId = id ?? `p${Date.now().toString(36)}`;

  const current = await db.select({ id: pipelineStages.id }).from(pipelineStages).where(eq(pipelineStages.pipeline, pipelineId));
  const owned = new Set(current.map((s) => s.id));
  if (stages.some((s) => s.id !== null && !owned.has(s.id))) return { ok: false, error: "Etapa não encontrada. Atualize a página." };
  const targets = new Set(kept.flatMap((s) => (s.id === null ? [] : [s.id])));

  // Validar antes da transação: nenhuma etapa com negócios pode sair sem destino
  for (const s of removed) {
    const [{ n }] = await db.select({ n: count() }).from(deals).where(eq(deals.stageId, s.id!));
    if (n > 0 && (!s.moveTo || !targets.has(s.moveTo))) return { ok: false, error: `Escolha para onde mover os negócios de "${s.name}".` };
  }

  await db.transaction(async (tx) => {
    for (const s of removed) {
      if (s.moveTo) await tx.update(deals).set({ stageId: s.moveTo }).where(eq(deals.stageId, s.id!));
    }
    for (const [i, s] of kept.entries()) {
      const values = { name: s.name, color: s.color, order: i + 1 };
      if (s.id === null) await tx.insert(pipelineStages).values({ ...values, pipeline: pipelineId });
      else await tx.update(pipelineStages).set(values).where(eq(pipelineStages.id, s.id));
    }
    if (removed.length) await tx.delete(pipelineStages).where(inArray(pipelineStages.id, removed.map((s) => s.id!)));
    await writePipelines(tx, id ? pipelines.map((p) => (p.id === id ? { ...p, label } : p)) : [...pipelines, { id: pipelineId, label }]);
  });
  refresh();
  return { ok: true, id: pipelineId };
}

/** Só apaga um pipeline sem negócios: apagar as etapas levaria os negócios em cascata. */
export async function deletePipelineAction(id: string): Promise<PipelineResult> {
  if (!(await canManagePipelines())) return { ok: false, error: "Sem permissão." };
  const pipelines = await getPipelines();
  if (pipelines.length <= 1) return { ok: false, error: "Tem de ficar pelo menos um pipeline." };
  const [{ n }] = await db
    .select({ n: count() })
    .from(deals)
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(eq(pipelineStages.pipeline, id));
  if (n > 0) return { ok: false, error: "Este pipeline ainda tem negócios." };
  await db.transaction(async (tx) => {
    await tx.delete(pipelineStages).where(eq(pipelineStages.pipeline, id));
    await writePipelines(tx, pipelines.filter((p) => p.id !== id));
  });
  refresh();
  return { ok: true };
}
