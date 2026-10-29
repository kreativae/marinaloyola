import Link from "next/link";
import { Plus } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, pipelineStages } from "@/db/schema";
import { createDeal, moveDeal } from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel } from "@/components/admin-ui";
import { KanbanBoard } from "@/components/admin-client";
import { cn, eur } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PIPELINES = [
  { id: "mentoria", label: "Mentoria 1:1" },
  { id: "workshops", label: "Workshops & Cursos" },
];

const PRODUCTS = [
  "Mentoria Design Business",
  "Workshop — Marca Premium",
  "Curso Identidade com Assinatura",
  "Sessão Avulsa",
];

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const pipeline = p === "workshops" ? "workshops" : "mentoria";

  const [stages, dealRows, allContacts] = await Promise.all([
    db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipeline, pipeline))
      .orderBy(asc(pipelineStages.order)),
    db
      .select({ deal: deals, contactName: contacts.name, contactEmail: contacts.email })
      .from(deals)
      .innerJoin(contacts, eq(contacts.id, deals.contactId))
      .orderBy(desc(deals.updatedAt)),
    db.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(contacts.name),
  ]);

  const stageIds = new Set(stages.map((s) => s.id));
  const pipelineDeals = dealRows.filter((d) => stageIds.has(d.deal.stageId));
  const totalValue = pipelineDeals.reduce((a, d) => a + Number(d.deal.value), 0);

  async function onMove(cardId: number, columnId: string) {
    "use server";
    await moveDeal(cardId, Number(columnId));
  }

  return (
    <>
      <PageHeader
        title="Pipeline de vendas"
        subtitle={`${pipelineDeals.length} negócios ativos · valor total ${eur(totalValue)}. Arraste os cartões entre fases para atualizar.`}
        actions={
          <details className="group relative">
            <summary className="btn-primary flex cursor-pointer list-none !px-5 !py-2.5 !text-xs">
              <Plus size={14} /> Novo negócio
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-96 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <form action={createDeal} className="space-y-3">
                <select name="contactId" required className="field">
                  <option value="">Contacto...</option>
                  {allContacts.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
                <input name="title" required placeholder="Título do negócio *" className="field" />
                <select name="product" className="field">
                  {PRODUCTS.map((pr) => (
                    <option key={pr} value={pr} className="bg-white">
                      {pr}
                    </option>
                  ))}
                </select>
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Valor estimado (€)"
                  className="field"
                />
                <select name="stageId" className="field">
                  {stages.map((s) => (
                    <option key={s.id} value={s.id} className="bg-white">
                      {s.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary w-full !py-2.5 !text-xs">
                  Criar negócio
                </button>
              </form>
            </div>
          </details>
        }
      />

      {/* Tabs de pipeline */}
      <div className="mb-6 flex gap-2">
        {PIPELINES.map((pl) => (
          <Link
            key={pl.id}
            href={`/admin/pipeline?p=${pl.id}`}
            className={cn(
              "rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all",
              pipeline === pl.id
                ? "border-plum-bright bg-plum/20 text-plum"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-600"
            )}
          >
            {pl.label}
          </Link>
        ))}
      </div>

      <Panel>
        {stages.length === 0 ? (
          <EmptyState text="Sem fases configuradas para este pipeline." />
        ) : (
          <KanbanBoard
            columns={stages.map((s) => {
              const stageTotal = pipelineDeals
                .filter((d) => d.deal.stageId === s.id)
                .reduce((a, d) => a + Number(d.deal.value), 0);
              return {
                id: String(s.id),
                name: s.name,
                color: s.color,
                total: stageTotal > 0 ? eur(stageTotal) : undefined,
              };
            })}
            cards={pipelineDeals.map(({ deal, contactName }) => ({
              id: deal.id,
              columnId: String(deal.stageId),
              title: contactName,
              subtitle: deal.title,
              meta: eur(deal.value),
              chips: [deal.product, deal.owner],
              href: `/admin/crm/${deal.contactId}`,
            }))}
            onMove={onMove}
          />
        )}
      </Panel>

      <p className="mt-4 text-xs text-zinc-500">
        Cada movimento fica registado na timeline do contacto. As automações de email e
        WhatsApp por fase podem ser configuradas nas integrações.
      </p>
    </>
  );
}
