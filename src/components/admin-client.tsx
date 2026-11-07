"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Copy, GripVertical } from "lucide-react";
import { BottomSheet } from "@/components/sheet";
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

  // Arrastar não existe no toque: no telemóvel as fases deslizam e cada cartão tem "Mover"
  const [moving, setMoving] = useState<number | null>(null);
  const [activeCol, setActiveCol] = useState(0);
  const board = useRef<HTMLDivElement>(null);

  const colOf = (card: KanbanCardData) => moves[card.id] ?? card.columnId;
  const movingCard = cards.find((c) => c.id === moving);

  const goToColumn = (i: number) => {
    const el = board.current?.children[i] as HTMLElement | undefined;
    if (el && board.current) board.current.scrollTo({ left: el.offsetLeft - board.current.offsetLeft - 16, behavior: "smooth" });
  };

  function onBoardScroll() {
    const box = board.current;
    const first = box?.children[0] as HTMLElement | undefined;
    if (!box || !first) return;
    setActiveCol(Math.min(columns.length - 1, Math.round(box.scrollLeft / (first.offsetWidth + 12))));
  }

  function drop(colId: string) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (id != null) move(id, colId);
  }

  function move(id: number, colId: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || colOf(card) === colId) return;
    setMoves((m) => ({ ...m, [id]: colId }));
    start(async () => {
      await onMove(id, colId);
      router.refresh();
    });
  }

  return (
    <>
    <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 sm:hidden">
      {columns.map((col, i) => (
        <button
          key={col.id}
          type="button"
          onClick={() => goToColumn(i)}
          className={cn(
            "tap flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
            i === activeCol ? "border-plum bg-plum text-white" : "border-line bg-white text-zinc-600"
          )}
        >
          {col.name}
          <span className={cn("tabular-nums", i === activeCol ? "text-white/75" : "text-zinc-400")}>{cards.filter((c) => colOf(c) === col.id).length}</span>
        </button>
      ))}
    </div>
    <div
      ref={board}
      onScroll={onBoardScroll}
      className="admin-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-4 max-sm:no-scrollbar max-sm:-mx-4 max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-4 max-sm:px-4"
    >
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
              "flex min-w-[205px] flex-1 basis-0 flex-col rounded-[20px] p-2 transition-all duration-300 max-sm:min-w-[86%] max-sm:snap-start",
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoving(card.id);
                    }}
                    className="tap mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-100 py-2 text-xs font-semibold text-zinc-600 sm:hidden"
                  >
                    <ArrowRightLeft size={13} /> Mover
                  </button>
                </div>
              ))}
              {colCards.length === 0 && (
                <div
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-6 text-xs transition-colors",
                    over === col.id ? "border-plum/40 text-plum" : "border-zinc-300/60 text-zinc-400"
                  )}
                >
                  <span className="hidden sm:inline">Arraste para aqui</span>
                  <span className="sm:hidden">Nada nesta coluna</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    <BottomSheet open={!!movingCard} onClose={() => setMoving(null)} title={movingCard ? `Mover ${movingCard.title}` : undefined}>
      <div className="space-y-1.5 pt-2">
        {movingCard &&
          columns.map((col) => {
            const here = colOf(movingCard) === col.id;
            return (
              <button
                key={col.id}
                type="button"
                disabled={here}
                onClick={() => {
                  move(movingCard.id, col.id);
                  setMoving(null);
                  goToColumn(columns.indexOf(col));
                }}
                className={cn(
                  "tap flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-semibold",
                  here ? "bg-plum/[0.07] text-plum" : "bg-zinc-50 text-zinc-800"
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col.color }} />
                <span className="flex-1">{col.name}</span>
                {here && <Check size={16} />}
              </button>
            );
          })}
      </div>
    </BottomSheet>
    </>
  );
}
