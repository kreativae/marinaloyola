import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Layers,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, contacts, eventTypes, interactions, payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { BarChart, EmptyState, HBarRow, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { Badge } from "@/components/admin-ui";
import { CONTACT_STATUS, eur, fmtDate, fmtDateTime, num, SOURCES } from "@/lib/utils";

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
        eventName: eventTypes.name,
      })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(and(gte(appointments.startAt, now), eq(appointments.status, "confirmed")))
      .orderBy(appointments.startAt)
      .limit(5),
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

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}.`}
        subtitle={now.toLocaleDateString("pt-PT", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <>
            <Link href="/agendar" className="btn-ghost !px-5 !py-2.5 !text-xs">
              Página de agendamento <ArrowUpRight size={13} />
            </Link>
            <Link href="/admin/contactos" className="btn-primary !px-5 !py-2.5 !text-xs">
              <Users size={14} /> Contactos
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Novos leads (mês)"
          value={num(leadsMonth)}
          hint={`${totalContacts} contactos no total · conversão ${conversion}%`}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Receita confirmada (mês)"
          value={eur(revenueMonth)}
          hint={`${eur(revenueYear)} acumulado`}
          icon={<TrendingUp size={18} />}
          accent
        />
        <StatCard
          label="Agendamentos"
          value={num(upcoming)}
          hint="sessões confirmadas futuras"
          icon={<CalendarDays size={18} />}
        />
        <StatCard
          label="Pagamentos pendentes"
          value={eur(pendingTotal)}
          hint={`${pendingPayments.length} por confirmar`}
          icon={<Wallet size={18} />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Receita — últimos 6 meses"
          className="xl:col-span-2"
          action={
            <Link
              href="/admin/financeiro"
              className="flex items-center gap-1 text-xs font-semibold text-plum hover:text-plum"
            >
              Financeiro <ArrowUpRight size={13} />
            </Link>
          }
        >
          <BarChart data={revenueData} format={(n) => eur(n)} />
        </Panel>
        <Panel title="Próximas sessões">
          {upcomingAppts.length === 0 ? (
            <EmptyState text="Sem agendamentos futuros." />
          ) : (
            <ul className="space-y-3">
              {upcomingAppts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-950">{a.name}</p>
                    <p className="text-xs text-zinc-500">{a.eventName}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-plum">
                    {fmtDateTime(a.startAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/agenda"
            className="mt-4 flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum"
          >
            Gerir agenda <ArrowUpRight size={12} />
          </Link>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Novos leads — 6 meses">
          <BarChart data={leadData} />
        </Panel>
        <Panel title="Origem dos leads">
          <div className="space-y-4">
            {sources.length === 0 && <EmptyState text="Ainda sem dados." />}
            {sources
              .sort((a, b) => b.n - a.n)
              .map((s) => (
                <HBarRow
                  key={s.source}
                  label={SOURCES[s.source] ?? s.source}
                  value={s.n}
                  total={sourceTotal}
                  display={num(s.n)}
                />
              ))}
          </div>
        </Panel>
        <Panel
          title="Pipeline"
          action={
            <Link
              href="/admin/pipeline"
              className="flex items-center gap-1 text-xs font-semibold text-plum hover:text-plum"
            >
              <Layers size={12} /> Abrir
            </Link>
          }
        >
          <div className="space-y-4">
            {stages.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-500">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-xs font-semibold text-zinc-600">
                    {num(s.n)} · {eur(s.total)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max((s.n / stageTotal) * 100, 3)}%`, background: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Atividade recente" className="xl:col-span-2">
          {recentInteractions.length === 0 ? (
            <EmptyState text="Sem atividade ainda." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentInteractions.map((i) => (
                <li key={i.id} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-plum-bright" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-600">
                      <Link
                        href={`/admin/crm/${i.contactId}`}
                        className="font-semibold text-zinc-950 hover:text-plum"
                      >
                        {i.contactName}
                      </Link>{" "}
                      <span className="text-zinc-500">— {i.content}</span>
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
                      {fmtDate(i.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Top clientes">
            {tops.length === 0 ? (
              <EmptyState text="Sem vendas confirmadas." />
            ) : (
              <ul className="space-y-3.5">
                {tops.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-3">
                    <span className="w-5 font-display text-lg italic text-plum">
                      {i + 1}º
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-950">{t.name}</p>
                      <p className="text-[11px] text-zinc-500">{num(t.n)} compra(s)</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-plum">
                      {eur(t.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Alertas">
            {pendingPayments.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Tudo em dia.
              </p>
            ) : (
              <ul className="space-y-3">
                {pendingPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-zinc-600">
                      {p.contactName} · {p.product}
                    </span>
                    <Badge label={eur(p.amount)} className="border-amber-500/30 bg-amber-500/10 !text-amber-700" />
                  </li>
                ))}
                <Link
                  href="/admin/financeiro"
                  className="mt-1 flex items-center gap-1 text-xs font-semibold text-plum hover:text-plum"
                >
                  Rever pagamentos <ArrowUpRight size={12} />
                </Link>
              </ul>
            )}
          </Panel>
          <div className="card border-plum/30 bg-plum/[0.04] p-5">
            <p className="text-xs leading-relaxed text-zinc-500">
              <span className="font-semibold text-plum">Estado do contacto:</span>{" "}
              {CONTACT_STATUS.client.label}s representam {conversion}% da base. Continue a
              alimentar o pipeline.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
