"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Copy,
  GraduationCap,
  GripVertical,
  LayoutDashboard,
  Layers,
  Megaphone,
  MessageCircle,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------ SIDEBAR --------------------------------- */

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/contactos", label: "Contactos", icon: Users },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/pipeline", label: "Pipeline", icon: Layers },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/cursos", label: "Cursos & LMS", icon: GraduationCap },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];

// As fichas individuais continuam em /admin/crm/[id] e pertencem a "Contactos"
function isActive(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/contactos") return pathname.startsWith(href) || pathname.startsWith("/admin/crm");
  return pathname.startsWith(href);
}

export function SidebarNav({ horizontal = false }: { horizontal?: boolean }) {
  const realPath = usePathname();
  // Destaque optimista: o item clicado fica activo de imediato, antes de a página chegar
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const pathname = clicked && clicked.from === realPath ? clicked.href : realPath;
  const onNav = (href: string) => () => setClicked({ href, from: realPath });
  if (horizontal) {
    return (
      <nav className="flex gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav(item.href)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                active ? "bg-plum/20 text-plum" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              <item.icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNav(item.href)}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-plum/[0.08] text-plum"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            )}
          >
            <item.icon
              size={17}
              className={cn("transition-colors", active ? "text-plum" : "text-zinc-500 group-hover:text-zinc-500")}
            />
            {item.label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-plum-bright" />}
          </Link>
        );
      })}
    </nav>
  );
}

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
}: {
  columns: KanbanColumn[];
  cards: KanbanCardData[];
  onMove: (cardId: number, columnId: string) => Promise<void>;
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
    <div className="flex gap-4 overflow-x-auto pb-4">
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
              "flex w-72 shrink-0 flex-col rounded-2xl border bg-zinc-50 p-3 transition-all",
              over === col.id ? "border-plum-bright/60 bg-plum/[0.05]" : "border-zinc-200"
            )}
          >
            <div className="flex items-center gap-2 px-1.5 pb-3 pt-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">
                {col.name}
              </h3>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                {colCards.length}
              </span>
              {col.total && (
                <span className="ml-auto text-[11px] font-semibold tabular-nums text-plum">
                  {col.total}
                </span>
              )}
            </div>
            <div className="flex min-h-[120px] flex-col gap-2.5">
              {colCards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => setDragId(card.id)}
                  className={cn(
                    "group cursor-grab rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-plum/50 active:cursor-grabbing",
                    dragId === card.id && "rotate-2 opacity-60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} className="mt-0.5 shrink-0 text-zinc-700" />
                    <div className="min-w-0 flex-1">
                      {card.href ? (
                        <Link
                          href={card.href}
                          className="block truncate text-sm font-semibold text-zinc-950 transition-colors hover:text-plum"
                        >
                          {card.title}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-semibold text-zinc-950">{card.title}</p>
                      )}
                      {card.subtitle && (
                        <p className="mt-1 truncate text-xs text-zinc-500">{card.subtitle}</p>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {card.chips?.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
                          >
                            {chip}
                          </span>
                        ))}
                        {card.meta && (
                          <span className="ml-auto text-sm font-bold tabular-nums text-plum">
                            {card.meta}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {colCards.length === 0 && (
                <div
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-[11px] uppercase tracking-widest transition-colors",
                    over === col.id
                      ? "border-plum-bright/60 text-plum"
                      : "border-zinc-200 text-zinc-700"
                  )}
                >
                  Largar aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex w-10 shrink-0 items-start justify-center pt-4 text-zinc-700">
        <ArrowUpRight size={16} />
      </div>
    </div>
  );
}
