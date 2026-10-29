import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { contacts, expenses, payments } from "@/db/schema";
import { PERIODS, type PeriodKey } from "@/lib/finance-def";

export { EXPENSE_CATEGORIES, PERIODS, type PeriodKey } from "@/lib/finance-def";

export const PAID = ["confirmed", "completed"] as const;

/* -------------------------------- PERÍODOS -------------------------------- */

/** Intervalo [from, to) do período e o período anterior equivalente (para comparar). */
export function periodRange(key: PeriodKey, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "mes":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), prevFrom: new Date(y, m - 1, 1), prevTo: new Date(y, m, 1) };
    case "mes-anterior":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1), prevFrom: new Date(y, m - 2, 1), prevTo: new Date(y, m - 1, 1) };
    case "90d": {
      const to = new Date(y, m, now.getDate() + 1);
      const from = new Date(to.getTime() - 90 * 86_400_000);
      return { from, to, prevFrom: new Date(from.getTime() - 90 * 86_400_000), prevTo: from };
    }
    case "ano":
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), prevFrom: new Date(y - 1, 0, 1), prevTo: new Date(y, 0, 1) };
    default:
      return { from: new Date(2000, 0, 1), to: new Date(y + 10, 0, 1), prevFrom: null, prevTo: null };
  }
}

export const asPeriod = (v: string | undefined): PeriodKey => (v && v in PERIODS ? (v as PeriodKey) : "mes");

/** Data que conta para a receita: quando foi recebido (ou criado, nos registos antigos). */
export const paidDate = sql`coalesce(${payments.paidAt}, ${payments.createdAt})`;

/* ------------------------------- FILTROS -------------------------------- */

export type PaymentFilters = { q?: string; estado?: string; metodo?: string; produto?: string };

export function paymentWhere(f: PaymentFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  const q = f.q?.trim();
  if (q) conds.push(or(ilike(contacts.name, `%${q}%`), ilike(payments.product, `%${q}%`), ilike(payments.reference, `%${q}%`)));
  if (f.estado === "atraso") {
    conds.push(sql`${payments.status} = 'pending' and ${payments.dueDate} < date_trunc('day', now())`);
  } else if (f.estado === "recebido") {
    conds.push(sql`${payments.status} in ('confirmed','completed')`);
  } else if (f.estado && ["pending", "confirmed", "completed", "refunded", "cancelled"].includes(f.estado)) {
    conds.push(eq(payments.status, f.estado as "pending"));
  }
  if (f.metodo && ["hotmart", "mbway", "transfer", "other"].includes(f.metodo)) {
    conds.push(eq(payments.method, f.metodo as "mbway"));
  }
  if (f.produto) conds.push(eq(payments.product, f.produto));
  const defined = conds.filter(Boolean) as SQL[];
  return defined.length ? and(...defined) : undefined;
}

export function expenseWhere(f: { q?: string; categoria?: string }): SQL | undefined {
  const conds: SQL[] = [];
  const q = f.q?.trim();
  if (q) conds.push(or(ilike(expenses.description, `%${q}%`), ilike(expenses.supplier, `%${q}%`))!);
  if (f.categoria) conds.push(eq(expenses.category, f.categoria));
  return conds.length ? and(...conds) : undefined;
}

export const isOverdue = (p: { status: string; dueDate: Date | null }, now = new Date()) =>
  p.status === "pending" && p.dueDate !== null && p.dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
