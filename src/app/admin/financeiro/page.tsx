import Link from "next/link";
import { Banknote, Plus, RotateCcw, TrendingUp, Wallet } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, payments } from "@/db/schema";
import { addPayment, setPaymentStatus } from "@/lib/actions-admin";
import { EmptyState, HBarRow, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { SelectAction } from "@/components/admin-client";
import { eur, fmtDate, num, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = Object.entries(PAYMENT_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));
const PRODUCTS = [
  "Mentoria Design Business",
  "Workshop — Marca Premium",
  "Curso Identidade com Assinatura",
  "Sessão Avulsa",
];

export default async function FinanceiroPage() {
  const [totalsRows, productRows, methodRows, paymentRows, allContacts] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN amount::numeric END), 0)::float AS confirmed,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount::numeric END), 0)::float AS pending,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount::numeric END), 0)::float AS refunded,
        COUNT(*)::int AS n
      FROM payments`),
    db.execute(sql`
      SELECT product, COALESCE(SUM(amount::numeric), 0)::float AS total, COUNT(*)::int AS n
      FROM payments WHERE status IN ('confirmed','completed')
      GROUP BY product ORDER BY total DESC`),
    db.execute(sql`
      SELECT method, COALESCE(SUM(amount::numeric), 0)::float AS total
      FROM payments WHERE status IN ('confirmed','completed')
      GROUP BY method ORDER BY total DESC`),
    db
      .select({ payment: payments, contactName: contacts.name })
      .from(payments)
      .leftJoin(contacts, eq(contacts.id, payments.contactId))
      .orderBy(desc(payments.createdAt))
      .limit(100),
    db.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(contacts.name),
  ]);

  const t = (totalsRows.rows as unknown as {
    confirmed: number;
    pending: number;
    refunded: number;
    n: number;
  }[])[0] ?? { confirmed: 0, pending: 0, refunded: 0, n: 0 };
  const byProduct = productRows.rows as unknown as { product: string; total: number; n: number }[];
  const byMethod = methodRows.rows as unknown as { method: string; total: number }[];
  const productMax = Math.max(...byProduct.map((p) => p.total), 1);
  const methodMax = Math.max(...byMethod.map((p) => p.total), 1);

  return (
    <>
      <PageHeader
        title="Gestão financeira"
        subtitle="Pagamentos Hotmart, MBWay e transferências — com comprovativos, estados e relatórios por produto e método."
        actions={
          <details className="group relative">
            <summary className="btn-primary flex cursor-pointer list-none !px-5 !py-2.5 !text-xs">
              <Plus size={14} /> Registar pagamento
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-96 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                <Banknote size={13} /> Transferência / MBWay / manual
              </p>
              <form action={addPayment} className="space-y-3">
                <select name="contactId" required className="field">
                  <option value="">Contacto...</option>
                  {allContacts.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
                <select name="product" className="field">
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p} className="bg-white">
                      {p}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2.5">
                  <input name="amount" type="number" min="0" step="0.01" required placeholder="Valor (€) *" className="field" />
                  <select name="method" className="field">
                    {Object.entries(PAYMENT_METHODS)
                      .filter(([k]) => k !== "hotmart")
                      .map(([v, l]) => (
                        <option key={v} value={v} className="bg-white">
                          {l}
                        </option>
                      ))}
                  </select>
                </div>
                <select name="status" className="field">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value} className="bg-white">
                      {s.label}
                    </option>
                  ))}
                </select>
                <input name="reference" placeholder="Ref. / link do comprovativo" className="field" />
                <button type="submit" className="btn-primary w-full !py-2.5 !text-xs">
                  Registar e notificar timeline
                </button>
              </form>
            </div>
          </details>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receita confirmada" value={eur(t.confirmed)} icon={<TrendingUp size={18} />} accent />
        <StatCard label="Pendente" value={eur(t.pending)} hint="a aguardar confirmação" icon={<Wallet size={18} />} />
        <StatCard label="Reembolsado" value={eur(t.refunded)} icon={<RotateCcw size={18} />} />
        <StatCard label="Transações" value={num(t.n)} hint="no total" icon={<Banknote size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Receita por produto / serviço">
          <div className="space-y-4">
            {byProduct.length === 0 && <EmptyState text="Sem receita confirmada ainda." />}
            {byProduct.map((p) => (
              <HBarRow
                key={p.product}
                label={`${p.product} (${num(p.n)})`}
                value={p.total}
                total={productMax}
                display={eur(p.total)}
              />
            ))}
          </div>
        </Panel>
        <Panel title="Receita por método">
          <div className="space-y-4">
            {byMethod.length === 0 && <EmptyState text="Sem dados." />}
            {byMethod.map((m) => (
              <HBarRow
                key={m.method}
                label={PAYMENT_METHODS[m.method] ?? m.method}
                value={m.total}
                total={methodMax}
                display={eur(m.total)}
              />
            ))}
          </div>
          <p className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
            Pagamentos Hotmart entram automaticamente via webhook. Transferências e MBWay
            são registados manualmente com comprovativo anexado.
          </p>
        </Panel>
      </div>

      <Panel title="Histórico de transações" className="mt-6">
        {paymentRows.length === 0 ? (
          <EmptyState text="Sem transações registadas." />
        ) : (
          <div className="table-shell">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="admin-th">Contacto</th>
                  <th className="admin-th hidden lg:table-cell">Produto</th>
                  <th className="admin-th hidden md:table-cell">Método</th>
                  <th className="admin-th">Valor</th>
                  <th className="admin-th hidden lg:table-cell">Data</th>
                  <th className="admin-th">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paymentRows.map(({ payment: p, contactName }) => (
                  <tr key={p.id} className="transition-colors hover:bg-zinc-50">
                    <td className="admin-td">
                      <Link
                        href={`/admin/crm/${p.contactId}`}
                        className="font-semibold text-zinc-950 hover:text-plum"
                      >
                        {contactName}
                      </Link>
                      {p.reference && (
                        <span className="block max-w-[180px] truncate text-[11px] text-zinc-500">
                          ref. {p.reference}
                        </span>
                      )}
                    </td>
                    <td className="admin-td hidden text-xs lg:table-cell">{p.product}</td>
                    <td className="admin-td hidden text-xs uppercase tracking-wider md:table-cell">
                      {PAYMENT_METHODS[p.method]}
                    </td>
                    <td className="admin-td font-bold tabular-nums text-zinc-950">{eur(p.amount)}</td>
                    <td className="admin-td hidden text-xs text-zinc-500 lg:table-cell">
                      {fmtDate(p.createdAt)}
                    </td>
                    <td className="admin-td">
                      <SelectAction
                        value={p.status}
                        options={STATUS_OPTIONS}
                        onSelect={setPaymentStatus.bind(null, p.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
