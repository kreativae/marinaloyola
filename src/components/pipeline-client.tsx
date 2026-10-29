"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Loader2, Plus, RotateCcw, Save, Trash2, UserRound } from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/admin-client";
import { Modal } from "@/components/contacts-client";
import { createDealAction, deleteDeal, setDealOutcome, updateDealAction, type DealResult } from "@/lib/actions-pipeline";
import { moveDeal } from "@/lib/actions-admin";
import { cn, eur, initials } from "@/lib/utils";

const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";

export type DealData = {
  id: number;
  contactId: number;
  contactName: string;
  stageId: number;
  title: string;
  product: string;
  value: number;
  owner: string;
  outcome: string;
  expectedClose: string | null;
  notes: string | null;
  lostReason: string | null;
  updatedAt: string;
};

type Stage = { id: number; name: string; color: string };

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function useDealForm(action: (prev: DealResult | null, fd: FormData) => Promise<DealResult>, onDone: () => void) {
  const [state, run, pending] = useActionState(async (prev: DealResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) onDone();
    return r;
  }, null);
  return {
    state,
    pending,
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => run(fd));
    },
  };
}

function DealFields({ deal, stages, products }: { deal?: DealData; stages: Stage[]; products: string[] }) {
  return (
    <>
      <div>
        <label className={label}>Título *</label>
        <input name="title" required defaultValue={deal?.title} placeholder="Ex: Mentoria 12 semanas — Q1" className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Produto</label>
          <input name="product" list="deal-products" defaultValue={deal?.product} className="field" />
          <datalist id="deal-products">
            {products.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label}>Valor estimado</label>
          <div className="relative">
            <input
              name="value"
              inputMode="decimal"
              defaultValue={deal ? String(deal.value).replace(".", ",") : ""}
              placeholder="0,00"
              className="field !pr-9 text-right tabular-nums"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">€</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className={label}>Fase</label>
          <select name="stageId" defaultValue={deal?.stageId ?? stages[0]?.id} className="field">
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Fecho previsto</label>
          <input name="expectedClose" type="date" defaultValue={deal?.expectedClose?.slice(0, 10) ?? ""} className="field" />
        </div>
        <div>
          <label className={label}>Responsável</label>
          <input name="owner" defaultValue={deal?.owner ?? "Marina"} className="field" />
        </div>
      </div>
      <div>
        <label className={label}>Notas</label>
        <textarea name="notes" rows={3} defaultValue={deal?.notes ?? ""} placeholder="Próximo passo, objeções, contexto…" className="field resize-y" />
      </div>
    </>
  );
}

export function NewDealButton({
  contacts,
  stages,
  products,
}: {
  contacts: { id: number; name: string }[];
  stages: Stage[];
  products: string[];
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useDealForm(createDealAction, () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 !text-xs">
        <Plus size={14} /> Novo negócio
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo negócio">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label}>Contacto *</label>
            <select name="contactId" required defaultValue="" className="field">
              <option value="" disabled>
                Escolha o contacto…
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <DealFields stages={stages} products={products} />
          {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-5 !py-2.5 !text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Quadro do pipeline: arrastar entre fases e clicar para abrir o negócio. */
export function PipelineBoard({
  columns,
  deals,
  stages,
  products,
}: {
  columns: KanbanColumn[];
  deals: DealData[];
  stages: Stage[];
  products: string[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = deals.find((d) => d.id === openId);
  return (
    <>
      <KanbanBoard
        columns={columns}
        cards={deals.map((d) => {
          const idle = daysSince(d.updatedAt);
          const late = d.expectedClose && new Date(d.expectedClose) < new Date();
          return {
            id: d.id,
            columnId: String(d.stageId),
            title: d.contactName,
            subtitle: d.title,
            avatar: initials(d.contactName),
            accent: stages.find((s) => s.id === d.stageId)?.color,
            meta: eur(d.value),
            chips: [d.product],
            footer: late
              ? `Fecho previsto ultrapassado (${new Date(d.expectedClose!).toLocaleDateString("pt-PT")})`
              : idle >= 14
                ? `Parado há ${idle} dias`
                : d.expectedClose
                  ? `Fecho previsto ${new Date(d.expectedClose).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}`
                  : idle === 0
                    ? "Actualizado hoje"
                    : `Actualizado há ${idle} dia${idle > 1 ? "s" : ""}`,
            warn: Boolean(late) || idle >= 14,
          };
        })}
        onMove={async (id, col) => {
          await moveDeal(id, Number(col));
        }}
        onOpen={setOpenId}
      />
      {open && <DealModal key={open.id} deal={open} stages={stages} products={products} onClose={() => setOpenId(null)} />}
    </>
  );
}

export function DealModal({
  deal,
  stages,
  products,
  onClose,
}: {
  deal: DealData;
  stages: Stage[];
  products: string[];
  onClose: () => void;
}) {
  const { state, pending, onSubmit } = useDealForm(updateDealAction.bind(null, deal.id), onClose);
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      onClose();
    });

  return (
    <Modal open onClose={onClose} title={deal.title}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/crm/${deal.contactId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-plum/[0.08] hover:text-plum"
        >
          <UserRound size={13} /> {deal.contactName}
        </Link>
        {deal.outcome !== "open" && (
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              deal.outcome === "won" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            )}
          >
            {deal.outcome === "won" ? "Ganho" : `Perdido${deal.lostReason ? ` — ${deal.lostReason}` : ""}`}
          </span>
        )}
      </div>

      {deal.outcome === "open" && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => setDealOutcome(deal.id, "won"))}
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <CircleCheck size={17} /> Ganho
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const reason = prompt("Motivo da perda (opcional):", "");
              if (reason !== null) act(() => setDealOutcome(deal.id, "lost", reason));
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
          >
            <CircleX size={17} /> Perdido
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <DealFields deal={deal} stages={stages} products={products} />
        {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div className="flex gap-1">
            {deal.outcome !== "open" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(() => setDealOutcome(deal.id, "open"))}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <RotateCcw size={13} /> Reabrir
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm(`Apagar o negócio “${deal.title}”?`) && act(() => deleteDeal(deal.id))}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 size={13} /> Apagar
            </button>
          </div>
          <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Lista dos negócios fechados, com reabrir no clique. */
export function ClosedDeals({ deals, stages, products }: { deals: DealData[]; stages: Stage[]; products: string[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = deals.find((d) => d.id === openId);
  return (
    <>
      <ul className="divide-y divide-line">
        {deals.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => setOpenId(d.id)} className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-zinc-50">
              {d.outcome === "won" ? (
                <CircleCheck size={17} className="shrink-0 text-emerald-500" />
              ) : (
                <CircleX size={17} className="shrink-0 text-rose-400" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-900">{d.contactName}</span>
                <span className="block truncate text-xs text-zinc-500">
                  {d.title}
                  {d.lostReason && <span className="text-zinc-400"> · {d.lostReason}</span>}
                </span>
              </span>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", d.outcome === "won" ? "text-emerald-700" : "text-zinc-400 line-through")}>
                {eur(d.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <DealModal key={open.id} deal={open} stages={stages} products={products} onClose={() => setOpenId(null)} />}
    </>
  );
}
