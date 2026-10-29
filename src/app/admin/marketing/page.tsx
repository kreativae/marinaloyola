import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Layers, Plus, Trash2 } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { createPost, deletePost, movePost } from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel } from "@/components/admin-ui";
import { KanbanBoard } from "@/components/admin-client";
import { cn, monthLabel, POST_STATUS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  idea: "#71717a",
  production: "#0ea5e9",
  review: "#f59e0b",
  approved: "#a855f7",
  published: "#10b981",
};

const NETWORK_COLORS: Record<string, string> = {
  Instagram: "#c13584",
  Facebook: "#1877f2",
  LinkedIn: "#0a66c2",
  TikTok: "#18181b",
  YouTube: "#ff0000",
  Blog: "#34d399",
  Email: "#f59e0b",
};

const NETWORKS = Object.keys(NETWORK_COLORS);
const FORMATS = ["Carrossel", "Reels", "Stories", "Post estático", "Vídeo", "Artigo", "Newsletter"];

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; m?: string }>;
}) {
  const { view, m } = await searchParams;
  const mode = view === "calendar" ? "calendar" : "board";

  const now = new Date();
  const [y, mo] = (m ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const monthDate = new Date(y, (mo || 1) - 1, 1);
  const ym = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const allPosts = await db.select().from(posts).orderBy(desc(posts.publishAt));

  async function onMove(cardId: number, columnId: string) {
    "use server";
    await movePost(cardId, columnId);
  }

  // Calendar grid
  const firstOffset = (monthDate.getDay() + 6) % 7; // segunda = 0
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1)
    ),
  ];
  const postsByDay = new Map<string, typeof allPosts>();
  for (const p of allPosts) {
    if (!p.publishAt) continue;
    const key = new Date(p.publishAt).toDateString();
    const arr = postsByDay.get(key) ?? [];
    arr.push(p);
    postsByDay.set(key, arr);
  }

  return (
    <>
      <PageHeader
        title="Marketing & Conteúdo"
        subtitle="Esteira de produção e calendário editorial de todas as publicações, campanhas e newsletters."
        actions={
          <details className="group relative">
            <summary className="btn-primary flex cursor-pointer list-none !px-5 !py-2.5 !text-xs">
              <Plus size={14} /> Novo conteúdo
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-96 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <form action={createPost} className="space-y-3">
                <input name="title" required placeholder="Tema / título *" className="field" />
                <div className="grid grid-cols-2 gap-2.5">
                  <select name="network" className="field">
                    {NETWORKS.map((n) => (
                      <option key={n} value={n} className="bg-white">
                        {n}
                      </option>
                    ))}
                  </select>
                  <select name="format" className="field">
                    {FORMATS.map((f) => (
                      <option key={f} value={f} className="bg-white">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Data de publicação
                  </label>
                  <input name="publishAt" type="datetime-local" className="field" />
                </div>
                <button type="submit" className="btn-primary w-full !py-2.5 !text-xs">
                  Adicionar à esteira
                </button>
              </form>
            </div>
          </details>
        }
      />

      <div className="mb-6 flex gap-2">
        <Link
          href="/admin/marketing"
          className={cn(
            "flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all",
            mode === "board"
              ? "border-plum-bright bg-plum/20 text-plum"
              : "border-zinc-200 text-zinc-500 hover:text-zinc-600"
          )}
        >
          <Layers size={13} /> Esteira
        </Link>
        <Link
          href={`/admin/marketing?view=calendar&m=${ym}`}
          className={cn(
            "flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all",
            mode === "calendar"
              ? "border-plum-bright bg-plum/20 text-plum"
              : "border-zinc-200 text-zinc-500 hover:text-zinc-600"
          )}
        >
          <CalendarDays size={13} /> Calendário
        </Link>
      </div>

      {mode === "board" ? (
        <Panel>
          {allPosts.length === 0 ? (
            <EmptyState text="Sem conteúdos na esteira. Crie o primeiro." />
          ) : (
            <KanbanBoard
              columns={Object.entries(POST_STATUS).map(([id, name]) => ({
                id,
                name,
                color: STATUS_COLORS[id] ?? "#800080",
              }))}
              cards={allPosts.map((p) => ({
                id: p.id,
                columnId: p.status,
                title: p.title,
                subtitle: p.copy
                  ? p.copy.slice(0, 70) + (p.copy.length > 70 ? "…" : "")
                  : undefined,
                meta: p.publishAt
                  ? new Date(p.publishAt).toLocaleDateString("pt-PT", {
                      day: "2-digit",
                      month: "short",
                    })
                  : undefined,
                chips: [p.network, p.format],
              }))}
              onMove={onMove}
            />
          )}
        </Panel>
      ) : (
        <Panel
          title={monthLabel(ym)}
          action={
            <div className="flex items-center gap-1">
              <Link
                href={`/admin/marketing?view=calendar&m=${ymOf(prev)}`}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition-colors hover:border-plum/50 hover:text-zinc-950"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={15} />
              </Link>
              <Link
                href={`/admin/marketing?view=calendar&m=${ymOf(next)}`}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition-colors hover:border-plum/50 hover:text-zinc-950"
                aria-label="Próximo mês"
              >
                <ChevronRight size={15} />
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div
                key={d}
                className="bg-zinc-50 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"
              >
                {d}
              </div>
            ))}
            {cells.map((d, i) => {
              const dayPosts = d ? postsByDay.get(d.toDateString()) ?? [] : [];
              const isToday = d && d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[104px] bg-white p-2",
                    !d && "bg-zinc-50"
                  )}
                >
                  {d && (
                    <>
                      <p
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                          isToday ? "bg-plum text-white" : "text-zinc-500"
                        )}
                      >
                        {d.getDate()}
                      </p>
                      <div className="mt-1 space-y-1">
                        {dayPosts.slice(0, 3).map((p) => (
                          <div
                            key={p.id}
                            className="group flex items-center justify-between gap-1 truncate rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-1 text-[10px] font-medium text-zinc-600"
                            title={`${p.title} · ${p.network} · ${POST_STATUS[p.status]}`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: NETWORK_COLORS[p.network] ?? "#800080" }}
                              />
                              <span className="truncate">{p.title}</span>
                            </span>
                            <form action={deletePost.bind(null, p.id)} className="hidden group-hover:block">
                              <button type="submit" aria-label="Eliminar" className="text-zinc-500 hover:text-rose-600">
                                <Trash2 size={11} />
                              </button>
                            </form>
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <p className="px-1 text-[9px] text-zinc-500">+{dayPosts.length - 3} mais</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-zinc-500">
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                {POST_STATUS[s]}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
