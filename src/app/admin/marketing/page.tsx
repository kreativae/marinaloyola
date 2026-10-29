import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Columns3, Lightbulb, List, PenLine, Send } from "lucide-react";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { ContentBoard, ContentCalendar, ContentList, NewPostButton, type PostData } from "@/components/marketing-client";
import { NETWORK_COLORS } from "@/lib/marketing-def";
import { cn, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tab = "quadro" | "calendario" | "lista";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; m?: string; novo?: string; rede?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.view === "calendar" || sp.view === "calendario" ? "calendario" : sp.view === "lista" ? "lista" : "quadro";
  const network = sp.rede && sp.rede in NETWORK_COLORS ? sp.rede : undefined;

  const now = new Date();
  const [y, mo] = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m!.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const month = `${y}-${pad(mo)}`;

  const all = await db.select().from(posts).orderBy(asc(posts.publishAt), desc(posts.createdAt));
  const filtered = network ? all.filter((p) => p.network === network) : all;

  // Datas formatadas no servidor (hora de Lisboa) para o browser não as mudar de fuso
  const data: (PostData & { day: string | null; time: string | null })[] = filtered.map((p) => ({
    id: p.id,
    title: p.title,
    network: p.network,
    format: p.format,
    status: p.status,
    publishLocal: p.publishAt ? `${isoDay(p.publishAt)}T${pad(p.publishAt.getHours())}:${pad(p.publishAt.getMinutes())}` : null,
    publishLabel: p.publishAt
      ? `${p.publishAt.getDate()} ${p.publishAt.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "")}, ${pad(p.publishAt.getHours())}:${pad(p.publishAt.getMinutes())}`
      : null,
    copy: p.copy,
    hashtags: p.hashtags,
    link: p.link,
    notes: p.notes,
    day: p.publishAt ? isoDay(p.publishAt) : null,
    time: p.publishAt ? `${pad(p.publishAt.getHours())}:${pad(p.publishAt.getMinutes())}` : null,
  }));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ideas = filtered.filter((p) => p.status === "idea").length;
  const inProgress = filtered.filter((p) => p.status === "production" || p.status === "review").length;
  const scheduled = filtered.filter((p) => p.status === "approved" && p.publishAt && p.publishAt > now).length;
  const publishedMonth = filtered.filter((p) => p.status === "published" && p.publishAt && p.publishAt >= monthStart).length;
  const nextWeek = filtered.filter((p) => p.publishAt && p.publishAt > now && p.publishAt < new Date(now.getTime() + 7 * 86_400_000) && p.status !== "published");
  const notReady = nextWeek.filter((p) => p.status !== "approved").length;

  const q = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const base = { view: tab === "quadro" ? undefined : tab, rede: network, m: tab === "calendario" ? month : undefined };
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v) params.set(k, v);
    const s = params.toString();
    return `/admin/marketing${s ? `?${s}` : ""}`;
  };
  const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  return (
    <>
      <PageHeader
        title="Marketing & Conteúdo"
        subtitle="Da ideia à publicação: produção, calendário editorial e textos de cada rede."
        actions={<NewPostButton defaultOpen={sp.novo === "1"} />}
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ideias" value={num(ideas)} hint="à espera de produção" icon={<Lightbulb size={17} />} />
        <StatCard label="Em produção" value={num(inProgress)} hint="a criar ou em revisão" icon={<PenLine size={17} />} />
        <StatCard
          label="Próximos 7 dias"
          value={num(nextWeek.length)}
          hint={notReady ? `${notReady} ainda não aprovado(s)` : `${num(scheduled)} agendado(s) e aprovado(s)`}
          icon={<CalendarDays size={17} />}
          accent
        />
        <StatCard label="Publicados este mês" value={num(publishedMonth)} icon={<Send size={17} />} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-line bg-white p-1 shadow-[0_1px_2px_rgb(24_24_27/0.04)]">
          {(
            [
              ["quadro", "Quadro", Columns3],
              ["calendario", "Calendário", CalendarRange],
              ["lista", "Lista", List],
            ] as const
          ).map(([id, label, Icon]) => (
            <Link
              key={id}
              href={q({ view: id === "quadro" ? undefined : id, m: id === "calendario" ? month : undefined })}
              scroll={false}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-300",
                tab === id ? "bg-plum text-white shadow-[0_6px_16px_-8px_rgb(128_0_128/0.8)]" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={q({ rede: undefined })}
            scroll={false}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              !network ? "border-zinc-900 bg-zinc-900 text-white" : "border-line bg-white text-zinc-500 hover:text-zinc-900"
            )}
          >
            Todas
          </Link>
          {Object.entries(NETWORK_COLORS).map(([n, color]) => {
            const count = all.filter((p) => p.network === n).length;
            if (!count) return null;
            return (
              <Link
                key={n}
                href={q({ rede: n })}
                scroll={false}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  network === n ? "text-white" : "border-line bg-white text-zinc-600 hover:text-zinc-900"
                )}
                style={network === n ? { background: color, borderColor: color } : undefined}
              >
                {network !== n && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
                {n}
                <span className={network === n ? "text-white/70" : "text-zinc-400"}>{count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div key={`${tab}-${network}-${month}`} className="animate-[rise_0.45s_var(--ease-out-soft)_backwards]">
        {data.length === 0 && tab !== "calendario" ? (
          <Panel>
            <EmptyState text="Ainda não há conteúdos. Crie o primeiro em “Novo conteúdo”." />
          </Panel>
        ) : tab === "quadro" ? (
          <ContentBoard posts={data} />
        ) : tab === "lista" ? (
          <ContentList posts={data} />
        ) : (
          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <Link href={q({ m: ym(new Date(y, mo - 2, 1)) })} scroll={false} className="rounded-xl border border-line bg-white p-2 text-zinc-500 hover:border-plum/30 hover:text-plum" aria-label="Mês anterior">
                <ChevronLeft size={15} />
              </Link>
              <Link href={q({ m: ym(new Date(y, mo, 1)) })} scroll={false} className="rounded-xl border border-line bg-white p-2 text-zinc-500 hover:border-plum/30 hover:text-plum" aria-label="Mês seguinte">
                <ChevronRight size={15} />
              </Link>
              <Link href={q({ m: ym(now) })} scroll={false} className="rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:border-plum/30 hover:text-plum">
                Hoje
              </Link>
              <h2 className="ml-2 font-display text-[1.6rem] tracking-[-0.01em] text-zinc-950 first-letter:uppercase">
                {new Date(y, mo - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
              </h2>
            </div>
            <ContentCalendar month={month} today={isoDay(now)} posts={data} />
          </Panel>
        )}
      </div>
    </>
  );
}
