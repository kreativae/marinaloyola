"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------- SELECT COM AÇÃO ---------------------------- */

export function SelectAction({
  value,
  options,
  onSelect,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => Promise<void>;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => start(async () => onSelect(e.target.value))}
      className={cn(
        "cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 outline-none transition-colors hover:border-plum/50 disabled:opacity-50",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------ UTILITÁRIOS ----------------------------- */

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* noop */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-plum/50 hover:text-zinc-950"
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {copied ? "Copiado" : label}
    </button>
  );
}

/* ------------------------------ KANBAN ---------------------------------- */

export type KanbanCardData = {
  id: number;
  columnId: string;
  title: string;
  subtitle?: string;
  meta?: string;
  chips?: string[];
  href?: string;
  /** Iniciais num círculo à esquerda do título */
  avatar?: string;
  /** Cor da barra lateral do cartão */
  accent?: string;
  /** Linha pequena no fundo (ex: "há 3 dias", "publica a 12/11") */
  footer?: string;
  /** Destaca o rodapé a vermelho (atrasado, parado há muito tempo) */
  warn?: boolean;
};

export type KanbanColumn = {
  id: string;
  name: string;
  color: string;
  total?: string;
};

export function KanbanBoard({
  columns,
  cards,
  onMove,
  onOpen,
}: {
  columns: KanbanColumn[];
  cards: KanbanCardData[];
  onMove: (cardId: number, columnId: string) => Promise<void>;
  /** Clique no cartão (ex: abrir o editor); sem isto, segue o href */
  onOpen?: (cardId: number) => void;
}) {
  const router = useRouter();
  const [moves, setMoves] = useState<Record<number, string>>({});
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  const [lastCards, setLastCards] = useState(cards);
  if (cards !== lastCards) {
    setLastCards(cards);
    setMoves({});
  }

  const colOf = (card: KanbanCardData) => moves[card.id] ?? card.columnId;

  function drop(colId: string) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (id == null) return;
    const card = cards.find((c) => c.id === id);
    if (!card || colOf(card) === colId) return;
    setMoves((m) => ({ ...m, [id]: colId }));
    start(async () => {
      await onMove(id, colId);
      router.refresh();
    });
  }

  return (
    <div className="admin-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
      {columns.map((col) => {
        const colCards = cards.filter((c) => colOf(c) === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
            onDrop={() => drop(col.id)}
            className={cn(
              "flex w-[280px] shrink-0 flex-col rounded-[20px] p-2 transition-all duration-300",
              over === col.id ? "bg-plum/[0.07] ring-2 ring-plum/25" : "bg-zinc-200/40"
            )}
          >
            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.color }} />
              <h3 className="truncate text-[13px] font-semibold text-zinc-800">{col.name}</h3>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-zinc-500 shadow-sm">
                {colCards.length}
              </span>
              {col.total && <span className="ml-auto text-[11px] font-semibold tabular-nums text-zinc-500">{col.total}</span>}
            </div>
            <div className="flex min-h-[140px] flex-1 flex-col gap-2">
              {colCards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => setDragId(card.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onClick={() => (onOpen ? onOpen(card.id) : card.href && router.push(card.href))}
                  className={cn(
                    "group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-white p-3.5 shadow-[0_1px_2px_rgb(24_24_27/0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-plum/20 hover:shadow-[0_14px_30px_-18px_rgb(91_0_92/0.35)] active:cursor-grabbing",
                    dragId === card.id && "rotate-[1.5deg] scale-[1.02] opacity-60 shadow-xl"
                  )}
                >
                  {card.accent && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: card.accent }} />}
                  <div className="flex items-start gap-2.5">
                    {card.avatar && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-plum/[0.08] text-[10px] font-bold text-plum">
                        {card.avatar}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-zinc-950 transition-colors group-hover:text-plum">{card.title}</p>
                      {card.subtitle && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-500">{card.subtitle}</p>}
                    </div>
                    <GripVertical size={14} className="mt-0.5 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {(card.chips?.length || card.meta) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {card.chips?.map((chip) => (
                        <span key={chip} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                          {chip}
                        </span>
                      ))}
                      {card.meta && <span className="ml-auto text-[13px] font-semibold tabular-nums text-zinc-900">{card.meta}</span>}
                    </div>
                  )}
                  {card.footer && (
                    <p className={cn("mt-2.5 border-t border-line pt-2 text-[11px]", card.warn ? "font-semibold text-rose-600" : "text-zinc-400")}>
                      {card.footer}
                    </p>
                  )}
                </div>
              ))}
              {colCards.length === 0 && (
                <div
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-6 text-xs transition-colors",
                    over === col.id ? "border-plum/40 text-plum" : "border-zinc-300/60 text-zinc-400"
                  )}
                >
                  Arraste para aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
