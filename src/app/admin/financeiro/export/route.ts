import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, expenses, payments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { asPeriod, expenseWhere, paidDate, paymentWhere, periodRange } from "@/lib/finance";
import { fmtDate, num, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/utils";
import { csvCell } from "@/lib/security";

export const dynamic = "force-dynamic";

const cell = csvCell;
const csv = (header: string[], rows: unknown[][]) =>
  "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");

/** CSV dos recebimentos ou despesas com os mesmos filtros e período da página (abre no Excel). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "student") return new Response("Não autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const period = asPeriod(sp.periodo);
  const r = periodRange(period);
  const between = (col: ReturnType<typeof sql>) => sql`${col} >= ${r.from} and ${col} < ${r.to}`;
  const date = new Date().toISOString().slice(0, 10);

  if (sp.tipo === "despesas") {
    const rows = await db
      .select()
      .from(expenses)
      .where(and(expenseWhere(sp), period === "tudo" ? undefined : between(sql`${expenses.date}`)))
      .orderBy(desc(expenses.date));
    const body = csv(
      ["Data", "Descrição", "Categoria", "Fornecedor", "Valor (€)", "Mensal", "Notas"],
      rows.map((e) => [fmtDate(e.date), e.description, e.category, e.supplier, num(e.amount, 2), e.recurring ? "Sim" : "", e.notes])
    );
    return new Response(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="despesas-${date}.csv"` },
    });
  }

  const rows = await db
    .select({ p: payments, name: contacts.name, email: contacts.email })
    .from(payments)
    .leftJoin(contacts, eq(contacts.id, payments.contactId))
    .where(and(paymentWhere(sp), period === "tudo" ? undefined : or(eq(payments.status, "pending"), between(paidDate))))
    .orderBy(desc(paidDate));
  const body = csv(
    ["Contacto", "Email", "Produto", "Parcela", "Valor (€)", "Método", "Estado", "Recebido em", "Vencimento", "Referência", "Notas"],
    rows.map(({ p, name, email }) => [
      name,
      email,
      p.product,
      p.installments ? `${p.installment}/${p.installments}` : "",
      num(p.amount, 2),
      PAYMENT_METHODS[p.method],
      PAYMENT_STATUS[p.status]?.label,
      p.status === "confirmed" || p.status === "completed" ? fmtDate(p.paidAt ?? p.createdAt) : "",
      p.dueDate ? fmtDate(p.dueDate) : "",
      p.reference,
      p.notes,
    ])
  );
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="recebimentos-${date}.csv"` },
  });
}
