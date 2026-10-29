import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Layers,
  Mail,
  MessageCircle,
  Sparkles,
  StickyNote,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, contacts, eventTypes, interactions, payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { BarChart, EmptyState, HBarRow, Panel, StatCard } from "@/components/admin-ui";
import { countryOfTz, dayIn, flag, fmtTime, HOME_TZ } from "@/lib/timezones";
import { cn, eur, fmtDate, initials, INTERACTION_ICONS, num, SOURCES } from "@/lib/utils";

export const dynamic = "force-dynamic";

function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", ""),
    });
  }
  return out;
}

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [{ totalContacts }],
    [{ leadsMonth }],
    [{ clients }],
    [{ upcoming }],
    revenueRows,
    leadRows,
    sourceRows,
    stageRows,
    topRows,
    recentInteractions,
    upcomingAppts,
    pendingPayments,
  ] = await Promise.all([
    db.select({ totalContacts: count() }).from(contacts),
    db.select({ leadsMonth: count() }).from(contacts).where(gte(contacts.createdAt, monthStart)),
    db.select({ clients: count() }).from(contacts).where(eq(contacts.status, "client")),
    db
      .select({ upcoming: count() })
      .from(appointments)
      .where(and(gte(appointments.startAt, now), eq(appointments.status, "confirmed"))),
    db.execute(sql`
      SELECT to_char(created_at, 'YYYY-MM') AS ym, COALESCE(SUM(amount::numeric), 0)::float AS total
      FROM payments WHERE status IN ('confirmed', 'completed')
      GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT to_char(created_at, 'YYYY-MM') AS ym, COUNT(*)::int AS n
      FROM contacts GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT source, COUNT(*)::int AS n FROM contacts GROUP BY source`),
    db.execute(sql`
      SELECT ps.id, ps.name, ps.pipeline, ps.color, COUNT(d.id)::int AS n,
             COALESCE(SUM(d.value::numeric), 0)::float AS total
      FROM pipeline_stages ps LEFT JOIN deals d ON d.stage_id = ps.id
      GROUP BY ps.id ORDER BY ps.pipeline, ps."order"`),
    db.execute(sql`
      SELECT c.name, COALESCE(SUM(p.amount::numeric), 0)::float AS total, COUNT(p.id)::int AS n
      FROM payments p JOIN contacts c ON c.id = p.contact_id
      WHERE p.status IN ('confirmed', 'completed')
      GROUP BY c.name ORDER BY total DESC LIMIT 5`),
    db
      .select({
        id: interactions.id,
        type: interactions.type,
        content: interactions.content,
        createdAt: interactions.createdAt,
        contactName: contacts.name,
        contactId: contacts.id,
      })
      .from(interactions)
      .leftJoin(contacts, eq(contacts.id, interactions.contactId))
      .orderBy(desc(interactions.createdAt))
      .limit(8),
    db
      .select({
        id: appointments.id,
        name: appointments.name,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        timezone: appointments.timezone,
        contactId: appointments.contactId,
        eventName: eventTypes.name,
        color: eventTypes.color,
      })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(and(gte(appointments.startAt, now), eq(appointments.status, "confirmed")))
      .orderBy(appointments.startAt)
      .limit(6),
    db
      .select({
        id: payments.id,
        product: payments.product,
        amount: payments.amount,
        contactName: contacts.name,
      })
      .from(payments)
      .leftJoin(contacts, eq(contacts.id, payments.contactId))
      .where(eq(payments.status, "pending"))
      .orderBy(desc(payments.createdAt))
      .limit(6),
  ]);

  const months = lastMonths(6);
  const revenueMap = new Map(
    (revenueRows.rows as unknown as { ym: string; total: number }[]).map((r) => [r.ym, r.total])
  );
  const leadMap = new Map(
    (leadRows.rows as unknown as { ym: string; n: number }[]).map((r) => [r.ym, r.n])
  );
  const revenueData = months.map((m) => ({ label: m.label, value: revenueMap.get(m.key) ?? 0 }));
  const leadData = months.map((m) => ({ label: m.label, value: leadMap.get(m.key) ?? 0 }));
  const revenueMonth = revenueMap.get(months[months.length - 1].key) ?? 0;
  const revenueYear = (revenueRows.rows as unknown as { total: number }[]).reduce(
    (a, r) => a + Number(r.total),
    0
  );
  const sources = sourceRows.rows as unknown as { source: string; n: number }[];
  const stages = stageRows.rows as unknown as {
    id: number;
    name: string;
    pipeline: string;
    color: string;
    n: number;
    total: number;
  }[];
  const tops = topRows.rows as unknown as { name: string; total: number; n: number }[];
  const pendingTotal = pendingPayments.reduce((a, p) => a + Number(p.amount), 0);
  const conversion = totalContacts > 0 ? Math.round((clients / totalContacts) * 100) : 0;
  const sourceTotal = sources.reduce((a, s) => a + s.n, 0);
  const stageTotal = Math.max(...stages.map((s) => s.n), 1);

  const prevRevenue = revenueMap.get(months[months.length - 2].key) ?? 0;
  const delta = prevRevenue > 0 ? Math.round(((revenueMonth - prevRevenue) / prevRevenue) * 100) : null;
  const hour = Number(fmtTime(now, HOME_TZ).slice(0, 2));
  const greeting = hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const todayKey = dayIn(now, HOME_TZ);
  const todayCount = upcomingAppts.filter((a) => dayIn(a.startAt, HOME_TZ) === todayKey).length;
  const summary = [
    todayCount ? `${todayCount} sessão(ões) hoje` : "sem sessões hoje",
    pendingPayments.length ? `${pendingPayments.length} pagamento(s) por confirmar` : "pagamentos em dia",
    `${num(leadsMonth)} lead(s) novo(s) este mês`,
  ];

  return (
    <>
      {/* Boas-vindas */}
      <section className="mb-8 flex flex-wrap items-end justify-between gap-6 animate-[rise_0.6s_var(--ease-out-soft)_backwards]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.3em] text-plum">
            <span className="h-px w-6 bg-plum/40" />
            {now.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-3 font-display text-[2.4rem] font-medium leading-[1.02] tracking-[-0.025em] text-zinc-950 lg:text-[3.2rem]">
            {greeting}, <span className="italic text-plum">{user.name.split(" ")[0]}</span>.
          </h1>
          <p className="mt-3 text-[15px] text-zinc-500">
            {summary[0].charAt(0).toUpperCase() + summary[0].slice(1)}, {summary[1]} e {summary[2]}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/agendar" target="_blank" className="btn-ghost !px-5 !py-2.5 !text-xs">
            Página de agendamento <ArrowUpRight size={13} />
          </Link>
          <Link href="/admin/agenda?view=calendario&modo=semana" className="btn-primary !px-5 !py-2.5 !text-xs">
            <CalendarDays size={14} /> Agenda da semana
          </Link>
        </div>
      </section>

      {/* KPIs */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita do mês"
          value={eur(revenueMonth)}
          hint={
            delta === null
              ? `${eur(revenueYear)} acumulado`
              : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs. mês anterior · ${eur(revenueYear)} acumulado`
          }
          icon={<TrendingUp size={17} />}
          accent
        />
        <StatCard
          label="Novos leads (mês)"
          value={num(leadsMonth)}
          hint={`${num(totalContacts)} contactos · conversão ${conversion}%`}
          icon={<Users size={17} />}
        />
        <StatCard
          label="Sessões agendadas"
          value={num(upcoming)}
          hint={todayCount ? `${todayCount} hoje` : "nenhuma hoje"}
          icon={<CalendarDays size={17} />}
        />
        <StatCard
          label="Por receber"
          value={eur(pendingTotal)}
          hint={`${pendingPayments.length} pagamento(s) pendente(s)`}
          icon={<Wallet size={17} />}
        />
      </div>

      <div className="stagger mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Receita"
          description="Pagamentos confirmados nos últimos 6 meses"
          className="xl:col-span-2"
          action={
            <Link href="/admin/financeiro" className="group flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
              Financeiro <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          }
        >
          <BarChart data={revenueData} format={(n) => eur(n)} />
        </Panel>

        <Panel
          title="Próximas sessões"
          description={todayCount ? `${todayCount} hoje` : "Nenhuma sessão hoje"}
          action={
            <Link href="/admin/agenda" className="group flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
              Agenda <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          }
        >
          {upcomingAppts.length === 0 ? (
            <EmptyState text="Sem agendamentos futuros." icon={<CalendarDays size={18} />} />
          ) : (
            <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[27px] before:top-3 before:w-px before:bg-zinc-100">
              {upcomingAppts.map((a, i) => {
                const isToday = dayIn(a.startAt, HOME_TZ) === todayKey;
                const other = a.timezone !== HOME_TZ && fmtTime(a.startAt, a.timezone) !== fmtTime(a.startAt, HOME_TZ);
                return (
                  <li key={a.id} className="animate-[rise_0.5s_var(--ease-out-soft)_backwards]" style={{ animationDelay: `${150 + i * 60}ms` }}>
                    <Link
                      href={a.contactId ? `/admin/crm/${a.contactId}` : "/admin/agenda"}
                      className="group relative flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-zinc-50"
                    >
                      <span
                        className={cn(
                          "relative z-10 flex w-[42px] shrink-0 flex-col items-center rounded-xl py-1.5 leading-none",
                          isToday ? "bg-plum text-white" : "bg-zinc-100 text-zinc-700"
                        )}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                          {isToday ? "Hoje" : a.startAt.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "")}
                        </span>
                        <span className="mt-0.5 font-display text-lg font-semibold">{a.startAt.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-950 group-hover:text-plum">{a.name}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.color ?? "#800080" }} />
                          {a.eventName}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-zinc-900">{fmtTime(a.startAt, HOME_TZ)}</span>
                        {other && (
                          <span className="block text-[10px] font-semibold text-sky-700">
                            {flag(countryOfTz(a.timezone))} {fmtTime(a.startAt, a.timezone)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="stagger mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Novos leads" description="Contactos criados por mês">
          <BarChart data={leadData} />
        </Panel>
        <Panel title="Origem dos leads" description={`${num(sourceTotal)} contactos`}>
          <div className="space-y-4">
            {sources.length === 0 && <EmptyState text="Ainda sem dados." />}
            {sources
              .sort((a, b) => b.n - a.n)
              .map((s) => (
                <HBarRow key={s.source} label={SOURCES[s.source] ?? s.source} value={s.n} total={sourceTotal} display={num(s.n)} />
              ))}
          </div>
        </Panel>
        <Panel
          title="Pipeline"
          description="Negócios por etapa"
          action={
            <Link href="/admin/pipeline" className="group flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
              <Layers size={12} /> Abrir
            </Link>
          }
        >
          <div className="space-y-3.5">
            {stages.map((s, i) => (
              <div key={s.id} className="group">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-zinc-600 group-hover:text-zinc-950">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-700">
                    {num(s.n)} <span className="font-normal text-zinc-400">· {eur(s.total)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="grow-x h-full rounded-full"
                    style={{ width: `${Math.max((s.n / stageTotal) * 100, 3)}%`, background: s.color, animationDelay: `${i * 60}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="stagger mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Actividade recente" description="Tudo o que aconteceu nos contactos" className="xl:col-span-2">
          {recentInteractions.length === 0 ? (
            <EmptyState text="Sem atividade ainda." />
          ) : (
            <ul className="space-y-1">
              {recentInteractions.map((i) => {
                const meta = ACTIVITY[i.type] ?? ACTIVITY.system;
                return (
                  <li key={i.id}>
                    <Link
                      href={`/admin/crm/${i.contactId}`}
                      className="group flex items-start gap-3.5 rounded-2xl p-2.5 transition-colors hover:bg-zinc-50"
                    >
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.className)}>
                        <meta.icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-zinc-600">
                          <span className="font-semibold text-zinc-950 group-hover:text-plum">{i.contactName}</span>{" "}
                          <span className="text-zinc-500">{i.content}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-zinc-400">
                          {INTERACTION_ICONS[i.type] ?? i.type} · {relativeTime(i.createdAt, now)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Melhores clientes" description="Por valor confirmado">
            {tops.length === 0 ? (
              <EmptyState text="Sem vendas confirmadas." />
            ) : (
              <ul className="space-y-3">
                {tops.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum/[0.08] text-[11px] font-bold text-plum">
                      {initials(t.name)}
                      {i === 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] text-white ring-2 ring-white">
                          ★
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-950">{t.name}</p>
                      <p className="text-[11px] text-zinc-500">{num(t.n)} compra(s)</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900">{eur(t.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Por confirmar" description="Pagamentos pendentes">
            {pendingPayments.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="ping-soft absolute inset-0 rounded-full bg-emerald-400" />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Tudo em dia.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {pendingPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-zinc-600">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="truncate">
                        {p.contactName} · <span className="text-zinc-400">{p.product}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-amber-700">{eur(p.amount)}</span>
                  </li>
                ))}
                <li>
                  <Link href="/admin/financeiro" className="group mt-1 flex items-center gap-1 text-xs font-semibold text-plum">
                    Rever pagamentos <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

const ACTIVITY: Record<string, { icon: typeof Users; className: string }> = {
  note: { icon: StickyNote, className: "bg-amber-50 text-amber-700" },
  whatsapp: { icon: MessageCircle, className: "bg-emerald-50 text-emerald-700" },
  email: { icon: Mail, className: "bg-sky-50 text-sky-700" },
  purchase: { icon: Wallet, className: "bg-plum/[0.08] text-plum" },
  booking: { icon: CalendarDays, className: "bg-violet-50 text-violet-700" },
  system: { icon: Sparkles, className: "bg-zinc-100 text-zinc-500" },
};

function relativeTime(d: Date, now: Date) {
  const min = Math.round((now.getTime() - new Date(d).getTime()) / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return fmtDate(d);
}
