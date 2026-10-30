"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleX,
  Loader2,
  Package,
  PenLine,
  Plus,
  RotateCcw,
  Route,
  Save,
  Search,
  Trash2,
  UserCheck,
  UserRound,
} from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/admin-client";
import { Field, FormSection, IconInput, Modal, ModalFooter, MoneyInput, PillGroup } from "@/components/form-kit";
import { createDealAction, deleteDeal, setDealOutcome, updateDealAction, type DealResult } from "@/lib/actions-pipeline";
import { moveDeal } from "@/lib/actions-admin";
import { cn, eur, initials } from "@/lib/utils";


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

/** Data AAAA-MM-DD daqui a N dias (ou no fim do mês), para os atalhos do fecho previsto. */
function quickDate(kind: "7" | "30" | "fim") {
  const d = new Date();
  if (kind === "fim") return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  d.setDate(d.getDate() + Number(kind));
  return d;
}
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function DealFields({ deal, stages, products }: { deal?: DealData; stages: Stage[]; products: string[] }) {
  const [close, setClose] = useState(deal?.expectedClose?.slice(0, 10) ?? "");
  return (
    <>
      <FormSection icon={Briefcase} title="Negócio">
        <Field label="Título" required>
          <IconInput icon={PenLine}>
            <input name="title" required defaultValue={deal?.title} placeholder="Ex: Mentoria 12 semanas — Q1" className="field" />
          </IconInput>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Produto ou serviço">
            <IconInput icon={Package}>
              <input name="product" list="deal-products" defaultValue={deal?.product} placeholder="Escolha ou escreva" className="field" />
            </IconInput>
            <datalist id="deal-products">
              {products.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Valor estimado">
            <MoneyInput name="value" defaultValue={deal ? String(deal.value).replace(".", ",") : ""} />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={Route} title="Fase do pipeline">
        <PillGroup
          name="stageId"
          defaultValue={String(deal?.stageId ?? stages[0]?.id)}
          options={stages.map((st) => ({ value: String(st.id), label: st.name, color: st.color }))}
        />
      </FormSection>

      <FormSection icon={CalendarClock} title="Planeamento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecho previsto">
            <IconInput icon={CalendarDays}>
              <input name="expectedClose" type="date" value={close} onChange={(e) => setClose(e.target.value)} className="field" />
            </IconInput>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ["7", "+7 dias"],
                  ["30", "+30 dias"],
                  ["fim", "Fim do mês"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setClose(isoOf(quickDate(k)))}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-plum/[0.08] hover:text-plum"
                >
                  {l}
                </button>
              ))}
              {close && (
                <button type="button" onClick={() => setClose("")} className="rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-rose-600">
                  Limpar
                </button>
              )}
            </div>
          </Field>
          <Field label="Responsável">
            <IconInput icon={UserCheck}>
              <input name="owner" defaultValue={deal?.owner ?? "Marina"} className="field" />
            </IconInput>
          </Field>
        </div>
        <Field label="Notas">
          <textarea name="notes" rows={3} defaultValue={deal?.notes ?? ""} placeholder="Próximo passo, objeções, contexto…" className="field resize-y" />
        </Field>
      </FormSection>
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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo negócio"
        description="Uma oportunidade de venda com um contacto"
        icon={Briefcase}
        size="lg"
      >
        <form onSubmit={onSubmit}>
          <FormSection icon={UserRound} title="Contacto">
            <Field label="Com quem é o negócio" required>
              <IconInput icon={Search}>
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
              </IconInput>
            </Field>
          </FormSection>
          <DealFields stages={stages} products={products} />
          <ModalFooter error={state?.error}>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-5 !py-2.5 !text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="btn-primary !px-6 !py-2.5 !text-xs disabled:opacity-60">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar negócio
            </button>
          </ModalFooter>
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
    <Modal open onClose={onClose} title={deal.title} description={`${deal.product} · ${eur(deal.value)}`} icon={Briefcase} size="lg">
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

      <form onSubmit={onSubmit}>
        <DealFields deal={deal} stages={stages} products={products} />
        <ModalFooter error={state?.error}>
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
            className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={13} /> Apagar
          </button>
          <button type="submit" disabled={pending} className="btn-primary !px-6 !py-2.5 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </ModalFooter>
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
