import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { and, asc, count, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts, courses, expenses, payments } from "@/db/schema";
import { CashflowChart, EmptyState, HBarRow, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import {
  ExpenseActions,
  ExpenseFormButton,
  PaymentActions,
  PaymentFormButton,
  type ExpenseRow,
  type PaymentRow,
} from "@/components/finance-client";
import {
  asPeriod,
  EXPENSE_CATEGORIES,
  expenseWhere,
  isOverdue,
  paidDate,
  paymentWhere,
  periodRange,
  PERIODS,
  type PaymentFilters,
  type PeriodKey,
} from "@/lib/finance";
import { cn, eur, fmtDate, num, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type Tab = "visao" | "recebimentos" | "despesas";
type Params = PaymentFilters & { tab?: string; periodo?: string; novo?: string; despesa?: string; categoria?: string; page?: string };

const paidCond = sql`${payments.status} in ('confirmed','completed')`;

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === "recebimentos" || sp.tab === "despesas" ? sp.tab : "visao";
  const period = asPeriod(sp.periodo);
  const range = periodRange(period);

  const [contactList, productRows, courseRows] = await Promise.all([
    db.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(asc(contacts.name)),
    db.selectDistinct({ product: payments.product }).from(payments),
    db.select({ title: courses.title }).from(courses),
  ]);
  const products = [...new Set([...courseRows.map((c) => c.title), ...productRows.map((p) => p.product), "Sessão Avulsa"])].sort((a, b) =>
    a.localeCompare(b, "pt")
  );

  // Mantém o período e o separador nos links
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { tab: tab === "visao" ? undefined : tab, periodo: period === "mes" ? undefined : period };
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/financeiro${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Receitas, valores a receber, despesas e lucro — por período."
        actions={
          <>
            <ExpenseFormButton defaultOpen={sp.despesa === "1"} />
            <PaymentFormButton contacts={contactList} products={products} defaultOpen={sp.novo === "1"} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-line bg-white p-1 shadow-[0_1px_2px_rgb(24_24_27/0.04)]">
          {(
            [
              ["visao", "Visão geral", LayoutGrid],
              ["recebimentos", "Recebimentos", Wallet],
              ["despesas", "Despesas", Receipt],
            ] as const
          ).map(([id, label, Icon]) => (
            <Link
              key={id}
              href={link({ tab: id === "visao" ? undefined : id, page: undefined })}
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
        <div className="flex flex-wrap gap-1 rounded-2xl bg-zinc-200/50 p-1">
          {(Object.entries(PERIODS) as [PeriodKey, string][]).map(([k, label]) => (
            <Link
              key={k}
              href={link({ periodo: k === "mes" ? undefined : k, page: undefined })}
              scroll={false}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                period === k ? "bg-white text-plum shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div key={`${tab}-${period}`} className="animate-[rise_0.45s_var(--ease-out-soft)_backwards]">
        {tab === "visao" && <Overview period={period} range={range} link={link} contacts={contactList} products={products} />}
        {tab === "recebimentos" && <Payments sp={sp} range={range} period={period} link={link} contacts={contactList} products={products} />}
        {tab === "despesas" && <Expenses sp={sp} range={range} period={period} link={link} />}
      </div>
    </>
  );
}

type Range = ReturnType<typeof periodRange>;
type LinkFn = (over: Record<string, string | undefined>) => string;

const inRange = (col: SQL, r: { from: Date; to: Date }) => sql`${col} >= ${r.from} and ${col} < ${r.to}`;

const toRow = (p: typeof payments.$inferSelect): PaymentRow => ({
  id: p.id,
  contactId: p.contactId,
  product: p.product,
  amount: Number(p.amount),
  method: p.method,
  status: p.status,
  reference: p.reference,
  notes: p.notes,
  dueDate: p.dueDate?.toISOString() ?? null,
  paidAt: (p.paidAt ?? p.createdAt).toISOString(),
  receiptName: p.receiptName,
});

/* ------------------------------ VISÃO GERAL ------------------------------ */

async function Overview({
  period,
  range,
  link,
  contacts: contactList,
  products,
}: {
  period: PeriodKey;
  range: Range;
  link: LinkFn;
  contacts: { id: number; name: string }[];
  products: string[];
}) {
  const sumPaid = (r: { from: Date; to: Date }) =>
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}::numeric), 0)`.mapWith(Number), n: count() })
      .from(payments)
      .where(and(paidCond, inRange(paidDate, r)))
      .then((x) => x[0]);
  const sumExp = (r: { from: Date; to: Date }) =>
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}::numeric), 0)`.mapWith(Number) })
      .from(expenses)
      .where(inRange(sql`${expenses.date}`, r))
      .then((x) => x[0].total);

  const now = new Date();
  const chartFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [income, spent, prevIncome, prevSpent, receivable, byProduct, byMethod, byCategory, incomeMonths, expenseMonths, refunds] =
    await Promise.all([
      sumPaid(range),
      sumExp(range),
      range.prevFrom ? sumPaid({ from: range.prevFrom, to: range.prevTo! }) : null,
      range.prevFrom ? sumExp({ from: range.prevFrom, to: range.prevTo! }) : null,
      db
        .select({ p: payments, name: contacts.name })
        .from(payments)
        .leftJoin(contacts, eq(contacts.id, payments.contactId))
        .where(eq(payments.status, "pending"))
        .orderBy(sql`${payments.dueDate} asc nulls last`, asc(payments.createdAt)),
      db
        .select({ product: payments.product, total: sql<number>`sum(${payments.amount}::numeric)`.mapWith(Number), n: count() })
        .from(payments)
        .where(and(paidCond, inRange(paidDate, range)))
        .groupBy(payments.product)
        .orderBy(sql`2 desc`),
      db
        .select({ method: payments.method, total: sql<number>`sum(${payments.amount}::numeric)`.mapWith(Number) })
        .from(payments)
        .where(and(paidCond, inRange(paidDate, range)))
        .groupBy(payments.method)
        .orderBy(sql`2 desc`),
      db
        .select({ category: expenses.category, total: sql<number>`sum(${expenses.amount}::numeric)`.mapWith(Number) })
        .from(expenses)
        .where(inRange(sql`${expenses.date}`, range))
        .groupBy(expenses.category)
        .orderBy(sql`2 desc`),
      db
        .select({ ym: sql<string>`to_char(${paidDate}, 'YYYY-MM')`, total: sql<number>`sum(${payments.amount}::numeric)`.mapWith(Number) })
        .from(payments)
        .where(and(paidCond, gte(paidDate, chartFrom)))
        .groupBy(sql`1`),
      db
        .select({ ym: sql<string>`to_char(${expenses.date}, 'YYYY-MM')`, total: sql<number>`sum(${expenses.amount}::numeric)`.mapWith(Number) })
        .from(expenses)
        .where(gte(expenses.date, chartFrom))
        .groupBy(sql`1`),
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amount}::numeric), 0)`.mapWith(Number) })
        .from(payments)
        .where(and(eq(payments.status, "refunded"), inRange(sql`${payments.createdAt}`, range)))
        .then((x) => x[0].total),
    ]);

  const profit = income.total - spent;
  const margin = income.total > 0 ? Math.round((profit / income.total) * 100) : null;
  const pct = (cur: number, prev: number | null | undefined) =>
    prev === null || prev === undefined || prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  const incDelta = pct(income.total, prevIncome?.total);
  const expDelta = pct(spent, prevSpent);
  const vs = period === "ano" ? "ano anterior" : period === "90d" ? "90 dias anteriores" : "mês anterior";
  const deltaText = (d: number | null) => (d === null ? null : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}% vs. ${vs}`);

  const receivableTotal = receivable.reduce((s, r) => s + Number(r.p.amount), 0);
  const overdue = receivable.filter((r) => isOverdue(r.p, now));
  const overdueTotal = overdue.reduce((s, r) => s + Number(r.p.amount), 0);

  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const incMap = new Map(incomeMonths.map((r) => [r.ym, r.total]));
  const expMap = new Map(expenseMonths.map((r) => [r.ym, r.total]));
  const chart = months.map((d) => ({
    label: d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", ""),
    income: incMap.get(ym(d)) ?? 0,
    expense: expMap.get(ym(d)) ?? 0,
  }));
  const yearIncome = chart.reduce((s, c) => s + c.income, 0);
  const yearExpense = chart.reduce((s, c) => s + c.expense, 0);
  const productTotal = byProduct.reduce((s, r) => s + r.total, 0);
  const methodTotal = byMethod.reduce((s, r) => s + r.total, 0);
  const categoryTotal = byCategory.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Receita · ${PERIODS[period].toLowerCase()}`}
          value={eur(income.total)}
          hint={deltaText(incDelta) ?? `${num(income.n)} recebimento(s)`}
          icon={<TrendingUp size={17} />}
          accent
        />
        <StatCard
          label="Despesas"
          value={eur(spent)}
          hint={deltaText(expDelta) ?? (refunds ? `+ ${eur(refunds)} reembolsado` : "no período")}
          icon={<ArrowDownRight size={17} />}
        />
        <StatCard
          label="Lucro"
          value={eur(profit)}
          hint={margin === null ? "sem receita no período" : `margem de ${margin}%`}
          icon={<ArrowUpRight size={17} />}
        />
        <StatCard
          label="A receber"
          value={eur(receivableTotal)}
          hint={overdue.length ? `${overdue.length} em atraso · ${eur(overdueTotal)}` : `${receivable.length} pendente(s), nada em atraso`}
          icon={<Wallet size={17} />}
        />
      </div>

      <div className="stagger grid gap-6 xl:grid-cols-3">
        <Panel
          title="Fluxo de caixa"
          description={`Últimos 12 meses · receita ${eur(yearIncome)} · despesas ${eur(yearExpense)}`}
          className="xl:col-span-2"
        >
          <CashflowChart data={chart} format={eur} />
        </Panel>

        <Panel
          title="A receber"
          description={overdue.length ? `${overdue.length} pagamento(s) em atraso` : "Pendentes por data de vencimento"}
          action={
            <Link href={link({ tab: "recebimentos", estado: "pending" })} className="text-xs font-semibold text-zinc-500 hover:text-plum">
              Ver todos
            </Link>
          }
        >
          {receivable.length === 0 ? (
            <EmptyState text="Nada por receber." icon={<Wallet size={18} />} />
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {receivable.slice(0, 7).map(({ p, name }) => {
                const late = isOverdue(p, now);
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-zinc-50">
                    <span
                      className={cn(
                        "flex w-11 shrink-0 flex-col items-center rounded-xl py-1 leading-none",
                        late ? "bg-rose-50 text-rose-600" : "bg-zinc-100 text-zinc-600"
                      )}
                    >
                      {p.dueDate ? (
                        <>
                          <span className="text-[9px] font-bold uppercase">{p.dueDate.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "")}</span>
                          <span className="font-display text-base font-semibold">{p.dueDate.getDate()}</span>
                        </>
                      ) : (
                        <span className="py-1.5 text-[10px] font-bold">—</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/crm/${p.contactId}`} className="block truncate text-sm font-semibold text-zinc-900 hover:text-plum">
                        {name}
                      </Link>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {p.product}
                        {p.installments ? ` · ${p.installment}/${p.installments}` : ""}
                        {late && <span className="font-semibold text-rose-600"> · em atraso</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">{eur(p.amount)}</span>
                    <PaymentActions payment={toRow(p)} contacts={contactList} products={products} compact />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="stagger grid gap-6 lg:grid-cols-3">
        <Panel title="Receita por produto" description={PERIODS[period]}>
          <div className="space-y-4">
            {byProduct.length === 0 && <EmptyState text="Sem receita no período." />}
            {byProduct.map((r) => (
              <HBarRow key={r.product} label={`${r.product} · ${num(r.n)}`} value={r.total} total={productTotal} display={eur(r.total)} />
            ))}
          </div>
        </Panel>
        <Panel title="Receita por método" description={PERIODS[period]}>
          <div className="space-y-4">
            {byMethod.length === 0 && <EmptyState text="Sem receita no período." />}
            {byMethod.map((r) => (
              <HBarRow key={r.method} label={PAYMENT_METHODS[r.method] ?? r.method} value={r.total} total={methodTotal} display={eur(r.total)} />
            ))}
          </div>
        </Panel>
        <Panel
          title="Despesas por categoria"
          description={PERIODS[period]}
          action={
            <Link href={link({ tab: "despesas" })} className="text-xs font-semibold text-zinc-500 hover:text-plum">
              Ver despesas
            </Link>
          }
        >
          <div className="space-y-4">
            {byCategory.length === 0 && <EmptyState text="Sem despesas no período." icon={<Receipt size={18} />} />}
            {byCategory.map((r) => (
              <HBarRow
                key={r.category}
                label={r.category}
                value={r.total}
                total={categoryTotal}
                display={eur(r.total)}
                color={EXPENSE_CATEGORIES[r.category] ?? "#71717a"}
              />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------ RECEBIMENTOS ----------------------------- */

async function Payments({
  sp,
  range,
  period,
  link,
  contacts: contactList,
  products,
}: {
  sp: Params;
  range: Range;
  period: PeriodKey;
  link: LinkFn;
  contacts: { id: number; name: string }[];
  products: string[];
}) {
  // Pendentes aparecem sempre; os restantes pela data em que foram recebidos/criados
  const where = and(
    paymentWhere(sp),
    period === "tudo" ? undefined : or(eq(payments.status, "pending"), inRange(paidDate, range))
  );
  const page = Math.max(1, Number(sp.page) || 1);
  const [[{ total, n }], rows] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}::numeric), 0)`.mapWith(Number), n: count() })
      .from(payments)
      .leftJoin(contacts, eq(contacts.id, payments.contactId))
      .where(where),
    db
      .select({ p: payments, name: contacts.name })
      .from(payments)
      .leftJoin(contacts, eq(contacts.id, payments.contactId))
      .where(where)
      .orderBy(sql`case when ${payments.status} = 'pending' then 0 else 1 end`, sql`coalesce(${payments.dueDate}, ${paidDate}) desc`)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const filtered = Boolean(sp.q || sp.estado || sp.metodo || sp.produto);
  const now = new Date();
  const exportHref = `/admin/financeiro/export?tipo=recebimentos&${new URLSearchParams(
    Object.entries({ periodo: period, q: sp.q, estado: sp.estado, metodo: sp.metodo, produto: sp.produto }).filter(([, v]) => v) as [string, string][]
  )}`;

  return (
    <div className="space-y-4">
      <Form action="/admin/financeiro" className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="tab" value="recebimentos" />
        {period !== "mes" && <input type="hidden" name="periodo" value={period} />}
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input name="q" defaultValue={sp.q} placeholder="Pesquisar contacto, produto ou referência…" className="field !pl-10" />
        </div>
        <select name="estado" defaultValue={sp.estado ?? ""} className="field !w-auto">
          <option value="">Todos os estados</option>
          <option value="recebido">Recebidos</option>
          <option value="pending">Pendentes</option>
          <option value="atraso">Em atraso</option>
          <option value="refunded">Reembolsados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <select name="metodo" defaultValue={sp.metodo ?? ""} className="field !w-auto">
          <option value="">Todos os métodos</option>
          {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="produto" defaultValue={sp.produto ?? ""} className="field !w-auto max-w-[220px]">
          <option value="">Todos os produtos</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-dark !px-5 !py-2.5 !text-xs">
          Filtrar
        </button>
        {filtered && (
          <Link href={link({ tab: "recebimentos" })} className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
            <X size={13} /> Limpar
          </Link>
        )}
        <a href={exportHref} download className="btn-ghost ml-auto !px-4 !py-2.5 !text-xs">
          <Download size={14} /> CSV
        </a>
      </Form>

      <p className="px-1 text-xs text-zinc-500">
        {num(n)} registo(s) · <b className="font-semibold text-zinc-800">{eur(total)}</b>
        {period !== "tudo" && ` · ${PERIODS[period].toLowerCase()} (pendentes sempre incluídos)`}
      </p>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState text={filtered ? "Nenhum recebimento com estes filtros." : "Sem recebimentos no período."} icon={<Wallet size={18} />} />
        </Panel>
      ) : (
        <div className="table-shell">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <th className="admin-th">Contacto · produto</th>
                <th className="admin-th hidden md:table-cell">Data</th>
                <th className="admin-th hidden lg:table-cell">Método</th>
                <th className="admin-th text-right">Valor</th>
                <th className="admin-th">Estado</th>
                <th className="admin-th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, name }) => {
                const late = isOverdue(p, now);
                const st = PAYMENT_STATUS[p.status];
                return (
                  <tr key={p.id} className="hover:bg-zinc-50/60">
                    <td className="admin-td">
                      <Link href={`/admin/crm/${p.contactId}`} className="font-semibold text-zinc-950 hover:text-plum">
                        {name}
                      </Link>
                      <span className="block max-w-[280px] truncate text-xs text-zinc-500">
                        {p.product}
                        {p.installments && (
                          <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                            {p.installment}/{p.installments}
                          </span>
                        )}
                        {p.reference && <span className="text-zinc-400"> · {p.reference}</span>}
                      </span>
                    </td>
                    <td className="admin-td hidden whitespace-nowrap text-xs md:table-cell">
                      {p.status === "pending" ? (
                        p.dueDate ? (
                          <span className={cn("flex items-center gap-1", late ? "font-semibold text-rose-600" : "text-zinc-500")}>
                            {late && <AlertTriangle size={12} />} vence {fmtDate(p.dueDate)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">sem vencimento</span>
                        )
                      ) : (
                        <span className="text-zinc-500">{fmtDate(p.paidAt ?? p.createdAt)}</span>
                      )}
                    </td>
                    <td className="admin-td hidden text-xs text-zinc-500 lg:table-cell">{PAYMENT_METHODS[p.method]}</td>
                    <td className={cn("admin-td whitespace-nowrap text-right font-semibold tabular-nums", p.status === "refunded" || p.status === "cancelled" ? "text-zinc-400 line-through" : "text-zinc-950")}>
                      {eur(p.amount)}
                    </td>
                    <td className="admin-td">
                      <span className={cn("chip whitespace-nowrap", late ? "border-rose-200 bg-rose-50 text-rose-700" : st?.className)}>
                        {late ? "Em atraso" : st?.label}
                      </span>
                    </td>
                    <td className="admin-td">
                      <PaymentActions payment={toRow(p)} contacts={contactList} products={products} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} href={(pg) => link({ tab: "recebimentos", q: sp.q, estado: sp.estado, metodo: sp.metodo, produto: sp.produto, page: String(pg) })} />
    </div>
  );
}

/* -------------------------------- DESPESAS ------------------------------- */

async function Expenses({ sp, range, period, link }: { sp: Params; range: Range; period: PeriodKey; link: LinkFn }) {
  const where = and(expenseWhere(sp), period === "tudo" ? undefined : inRange(sql`${expenses.date}`, range));
  const page = Math.max(1, Number(sp.page) || 1);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [[{ total, n }], rows, recurringThisMonth] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}::numeric), 0)`.mapWith(Number), n: count() })
      .from(expenses)
      .where(where),
    db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    // Despesas mensais já lançadas este mês (pela descrição), para não sugerir lançar outra vez
    db
      .select({ description: expenses.description })
      .from(expenses)
      .where(and(eq(expenses.recurring, true), gte(expenses.date, monthStart), lt(expenses.date, new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)))),
  ]);
  const launched = new Set(recurringThisMonth.map((r) => r.description));
  const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const filtered = Boolean(sp.q || sp.categoria);
  const exportHref = `/admin/financeiro/export?tipo=despesas&${new URLSearchParams(
    Object.entries({ periodo: period, q: sp.q, categoria: sp.categoria }).filter(([, v]) => v) as [string, string][]
  )}`;

  return (
    <div className="space-y-4">
      <Form action="/admin/financeiro" className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="tab" value="despesas" />
        {period !== "mes" && <input type="hidden" name="periodo" value={period} />}
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input name="q" defaultValue={sp.q} placeholder="Pesquisar descrição ou fornecedor…" className="field !pl-10" />
        </div>
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="field !w-auto">
          <option value="">Todas as categorias</option>
          {Object.keys(EXPENSE_CATEGORIES).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-dark !px-5 !py-2.5 !text-xs">
          Filtrar
        </button>
        {filtered && (
          <Link href={link({ tab: "despesas" })} className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
            <X size={13} /> Limpar
          </Link>
        )}
        <a href={exportHref} download className="btn-ghost ml-auto !px-4 !py-2.5 !text-xs">
          <Download size={14} /> CSV
        </a>
      </Form>

      <p className="px-1 text-xs text-zinc-500">
        {num(n)} despesa(s) · <b className="font-semibold text-zinc-800">{eur(total)}</b> · {PERIODS[period].toLowerCase()}
      </p>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState text={filtered ? "Nenhuma despesa com estes filtros." : "Sem despesas no período. Registe a primeira no botão “Despesa”."} icon={<Receipt size={18} />} />
        </Panel>
      ) : (
        <div className="table-shell">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <th className="admin-th">Descrição</th>
                <th className="admin-th hidden md:table-cell">Categoria</th>
                <th className="admin-th hidden sm:table-cell">Data</th>
                <th className="admin-th text-right">Valor</th>
                <th className="admin-th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const row: ExpenseRow = {
                  id: e.id,
                  description: e.description,
                  category: e.category,
                  amount: Number(e.amount),
                  date: e.date.toISOString(),
                  supplier: e.supplier,
                  recurring: e.recurring,
                  notes: e.notes,
                  receiptName: e.receiptName,
                };
                const color = EXPENSE_CATEGORIES[e.category] ?? "#71717a";
                return (
                  <tr key={e.id} className="hover:bg-zinc-50/60">
                    <td className="admin-td">
                      <span className="flex items-center gap-2 font-semibold text-zinc-950">
                        {e.description}
                        {e.recurring && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Mensal</span>
                        )}
                      </span>
                      {e.supplier && <span className="block text-xs text-zinc-500">{e.supplier}</span>}
                    </td>
                    <td className="admin-td hidden md:table-cell">
                      <span
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: `${color}14`, color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        {e.category}
                      </span>
                    </td>
                    <td className="admin-td hidden whitespace-nowrap text-xs text-zinc-500 sm:table-cell">{fmtDate(e.date)}</td>
                    <td className="admin-td whitespace-nowrap text-right font-semibold tabular-nums text-zinc-950">{eur(e.amount)}</td>
                    <td className="admin-td">
                      <ExpenseActions expense={row} repeatable={!launched.has(e.description)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} href={(pg) => link({ tab: "despesas", q: sp.q, categoria: sp.categoria, page: String(pg) })} />
    </div>
  );
}

function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const btn = "rounded-xl border border-line bg-white p-2 transition-colors hover:border-plum/30 hover:text-plum";
  return (
    <div className="flex items-center justify-end gap-1 text-xs text-zinc-500">
      {page > 1 ? (
        <Link href={href(page - 1)} className={btn} aria-label="Anterior">
          <ChevronLeft size={15} />
        </Link>
      ) : (
        <span className={cn(btn, "opacity-40")}>
          <ChevronLeft size={15} />
        </span>
      )}
      <span className="px-3 font-semibold text-zinc-700">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={btn} aria-label="Seguinte">
          <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={cn(btn, "opacity-40")}>
          <ChevronRight size={15} />
        </span>
      )}
    </div>
  );
}
