import Link from "next/link";
import { ExternalLink, Eye, MousePointerClick, Percent, Trophy } from "lucide-react";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bioEvents, bioLinks, courses } from "@/db/schema";
import { BarChart, EmptyState, HBarRow, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { CopyButton } from "@/components/admin-client";
import { BioLinksManager, BioProfileForm, PhonePreview, type BioLinkRow } from "@/components/bio-admin";
import { getBioConfig } from "@/lib/bio";
import { appUrl } from "@/lib/settings";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FIXED: Record<string, string> = {
  agendar: "Agendar (todos os horários)",
  cursos: "Página de cursos",
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
};

export default async function BioLinksPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [cfg, links, courseRows, base, [{ views }], clicksByTarget, daily] = await Promise.all([
    getBioConfig(),
    db.select().from(bioLinks).orderBy(asc(bioLinks.order), asc(bioLinks.id)),
    db.select({ id: courses.id, title: courses.title }).from(courses),
    appUrl(),
    db.select({ views: count() }).from(bioEvents).where(and(eq(bioEvents.kind, "view"), gte(bioEvents.createdAt, since))),
    db
      .select({ target: bioEvents.target, n: count() })
      .from(bioEvents)
      .where(and(eq(bioEvents.kind, "click"), gte(bioEvents.createdAt, since)))
      .groupBy(bioEvents.target)
      .orderBy(desc(count())),
    db
      .select({ day: sql<string>`to_char(${bioEvents.createdAt}, 'YYYY-MM-DD')`, n: count() })
      .from(bioEvents)
      .where(and(eq(bioEvents.kind, "view"), gte(bioEvents.createdAt, new Date(now.getTime() - 14 * 86_400_000))))
      .groupBy(sql`1`),
  ]);

  // Nome legível de cada destino (links, cursos, atalhos de dia de agendamento)
  const labelOf = (t: string | null) => {
    if (!t) return "—";
    if (FIXED[t]) return FIXED[t];
    if (/^agendar-\d+-/.test(t)) return "Agendar (atalho de dia)";
    const l = t.match(/^l(\d+)$/);
    if (l) return links.find((x) => x.id === Number(l[1]))?.title ?? "Link apagado";
    const c = t.match(/^c(\d+)$/);
    if (c) return `Curso: ${courseRows.find((x) => x.id === Number(c[1]))?.title ?? "apagado"}`;
    return t;
  };
  // Atalhos de dia somam-se numa só linha
  const grouped = new Map<string, number>();
  for (const r of clicksByTarget) grouped.set(labelOf(r.target), (grouped.get(labelOf(r.target)) ?? 0) + r.n);
  const ranking = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  const clicks = ranking.reduce((s, [, n]) => s + n, 0);
  const ctr = views ? Math.round((clicks / views) * 100) : 0;

  const allClicks = await db
    .select({ target: bioEvents.target, n: count() })
    .from(bioEvents)
    .where(eq(bioEvents.kind, "click"))
    .groupBy(bioEvents.target);
  const linkRows: BioLinkRow[] = links.map((l) => ({
    id: l.id,
    title: l.title,
    subtitle: l.subtitle,
    url: l.url,
    image: l.image,
    highlight: l.highlight,
    active: l.active,
    clicks: allClicks.find((c) => c.target === `l${l.id}`)?.n ?? 0,
  }));

  const dayMap = new Map(daily.map((d) => [d.day, d.n]));
  const chart = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86_400_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { label: String(d.getDate()), value: dayMap.get(key) ?? 0 };
  });

  const url = `${base}/links`;

  return (
    <>
      <PageHeader
        title="Link na bio"
        subtitle="A página de links do Instagram: agendamento, cursos, newsletter e os seus links."
        actions={
          <>
            <CopyButton text={url} label="Copiar link" />
            <Link href="/links" target="_blank" className="btn-primary !px-5 !py-2.5 !text-xs">
              Abrir página <ExternalLink size={13} />
            </Link>
          </>
        }
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitas · 30 dias" value={num(views)} icon={<Eye size={17} />} accent />
        <StatCard label="Cliques · 30 dias" value={num(clicks)} icon={<MousePointerClick size={17} />} />
        <StatCard label="Taxa de clique" value={`${ctr}%`} hint="cliques por visita" icon={<Percent size={17} />} />
        <StatCard label="Mais clicado" value={ranking[0] ? num(ranking[0][1]) : "—"} hint={ranking[0]?.[0] ?? "ainda sem cliques"} icon={<Trophy size={17} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Links" description="Aparecem por esta ordem, depois do agendamento">
            <BioLinksManager links={linkRows} />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Visitas por dia" description="Últimos 14 dias">
              <BarChart data={chart} />
            </Panel>
            <Panel title="Cliques por destino" description="Últimos 30 dias">
              {ranking.length === 0 ? (
                <EmptyState text="Ainda sem cliques. Coloque o link na bio do Instagram." icon={<MousePointerClick size={18} />} />
              ) : (
                <div className="space-y-4">
                  {ranking.slice(0, 8).map(([name, n]) => (
                    <HBarRow key={name} label={name} value={n} total={clicks} display={num(n)} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Perfil e secções">
            <BioProfileForm values={cfg} />
          </Panel>
        </div>

        <div className="xl:sticky xl:top-24 xl:h-fit">
          <PhonePreview />
          <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500">
            Coloque <b className="font-semibold text-zinc-700">{url.replace(/^https?:\/\//, "")}</b> no campo “Site” do perfil do Instagram.
          </p>
        </div>
      </div>
    </>
  );
}
