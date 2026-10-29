import Link from "next/link";
import { CircleCheck, Layers, Target, TrendingUp, Trophy } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, courses, deals, pipelineStages } from "@/db/schema";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { ClosedDeals, NewDealButton, PipelineBoard, type DealData } from "@/components/pipeline-client";
import { cn, eur, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PIPELINES = [
  { id: "mentoria", label: "Mentoria 1:1" },
  { id: "workshops", label: "Workshops & Cursos" },
];

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const pipeline = p === "workshops" ? "workshops" : "mentoria";

  const [stages, dealRows, allContacts, courseRows] = await Promise.all([
    db.select().from(pipelineStages).where(eq(pipelineStages.pipeline, pipeline)).orderBy(asc(pipelineStages.order)),
    db
      .select({ deal: deals, contactName: contacts.name })
      .from(deals)
      .innerJoin(contacts, eq(contacts.id, deals.contactId))
      .orderBy(desc(deals.updatedAt)),
    db.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(contacts.name),
    db.select({ title: courses.title }).from(courses),
  ]);

  const stageIds = new Set(stages.map((s) => s.id));
  const toData = ({ deal, contactName }: (typeof dealRows)[number]): DealData => ({
    id: deal.id,
    contactId: deal.contactId,
    contactName,
    stageId: deal.stageId,
    title: deal.title,
    product: deal.product,
    value: Number(deal.value),
    owner: deal.owner,
    outcome: deal.outcome,
    expectedClose: deal.expectedClose?.toISOString() ?? null,
    notes: deal.notes,
    lostReason: deal.lostReason,
    updatedAt: deal.updatedAt.toISOString(),
  });
  const all = dealRows.filter((d) => stageIds.has(d.deal.stageId)).map(toData);
  const open = all.filter((d) => d.outcome === "open");
  const closed = all.filter((d) => d.outcome !== "open");
  const products = [...new Set(["Mentoria Design Business", "Sessão Avulsa", ...courseRows.map((c) => c.title), ...all.map((d) => d.product)])];

  // Previsão ponderada: quanto mais avançada a fase, maior a probabilidade de fecho
  const prob = new Map(stages.map((s, i) => [s.id, (i + 1) / (stages.length + 1)]));
  const openValue = open.reduce((s, d) => s + d.value, 0);
  const weighted = open.reduce((s, d) => s + d.value * (prob.get(d.stageId) ?? 0), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const wonMonth = dealRows.filter(
    (r) => stageIds.has(r.deal.stageId) && r.deal.outcome === "won" && r.deal.closedAt && r.deal.closedAt >= monthStart
  );
  const won = closed.filter((d) => d.outcome === "won").length;
  const winRate = closed.length ? Math.round((won / closed.length) * 100) : null;

  const columns = stages.map((s) => {
    const total = open.filter((d) => d.stageId === s.id).reduce((a, d) => a + d.value, 0);
    return { id: String(s.id), name: s.name, color: s.color, total: total > 0 ? eur(total) : undefined };
  });
  const stageList = stages.map(({ id, name, color }) => ({ id, name, color }));

  return (
    <>
      <PageHeader
        title="Pipeline de vendas"
        subtitle="Arraste os negócios entre fases; clique para editar, marcar como ganho ou perdido."
        actions={<NewDealButton contacts={allContacts} stages={stageList} products={products} />}
      />

      <div className="mb-6 inline-flex rounded-2xl border border-line bg-white p-1 shadow-[0_1px_2px_rgb(24_24_27/0.04)]">
        {PIPELINES.map((pl) => (
          <Link
            key={pl.id}
            href={`/admin/pipeline?p=${pl.id}`}
            scroll={false}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-300",
              pipeline === pl.id ? "bg-plum text-white shadow-[0_6px_16px_-8px_rgb(128_0_128/0.8)]" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <Layers size={15} /> {pl.label}
          </Link>
        ))}
      </div>

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Em aberto" value={eur(openValue)} hint={`${num(open.length)} negócio(s) activo(s)`} icon={<Layers size={17} />} accent />
        <StatCard label="Previsão ponderada" value={eur(weighted)} hint="valor × probabilidade da fase" icon={<Target size={17} />} />
        <StatCard
          label="Ganhos este mês"
          value={eur(wonMonth.reduce((s, r) => s + Number(r.deal.value), 0))}
          hint={`${wonMonth.length} negócio(s) fechado(s)`}
          icon={<Trophy size={17} />}
        />
        <StatCard
          label="Taxa de conversão"
          value={winRate === null ? "—" : `${winRate}%`}
          hint={closed.length ? `${won} ganho(s) de ${closed.length} fechado(s)` : "ainda sem negócios fechados"}
          icon={<TrendingUp size={17} />}
        />
      </div>

      {stages.length === 0 ? (
        <Panel>
          <EmptyState text="Sem fases configuradas para este pipeline." />
        </Panel>
      ) : (
        <PipelineBoard columns={columns} deals={open} stages={stageList} products={products} />
      )}

      {closed.length > 0 && (
        <Panel title="Negócios fechados" description={`${won} ganho(s) · ${closed.length - won} perdido(s)`} className="mt-6">
          <ClosedDeals deals={closed.slice(0, 12)} stages={stageList} products={products} />
        </Panel>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
        <CircleCheck size={13} className="text-plum" />
        Cada movimento fica registado no histórico do contacto. Ganhar um negócio marca o contacto como cliente.
      </p>
    </>
  );
}
