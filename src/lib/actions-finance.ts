"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, expenses, payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { addInteraction, tagContact } from "@/lib/crm";
import { EXPENSE_CATEGORIES } from "@/lib/finance";
import { filePath, MAX_FILE_BYTES, storeUpload } from "@/lib/files";
import { eur, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/utils";

export type FinanceResult = { ok: boolean; error?: string; savedAt?: number };

type Method = "hotmart" | "mbway" | "transfer" | "other";
type Status = "pending" | "confirmed" | "completed" | "refunded" | "cancelled";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const money = (raw: string) => Number(raw.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
const isPaid = (s: string) => s === "confirmed" || s === "completed";
/** "AAAA-MM-DD" do formulário → meio-dia local, para não mudar de dia com o fuso. */
const dateOf = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : null);

function refresh(contactId?: number) {
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
  if (contactId) revalidatePath(`/admin/crm/${contactId}`);
}

async function attachReceipt(fd: FormData) {
  const file = fd.get("receipt");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) throw new Error("O comprovativo excede 50 MB.");
  return { receiptName: file.name.slice(0, 200), receiptFile: await storeUpload(file, "comprovativos") };
}

/* ------------------------------ RECEBIMENTOS ----------------------------- */

/** Novo recebimento, opcionalmente dividido em parcelas mensais. */
export async function createPaymentAction(_prev: FinanceResult | null, fd: FormData): Promise<FinanceResult> {
  await requireAdmin();
  const contactId = Number(fd.get("contactId"));
  const product = str(fd, "product") || str(fd, "productOther");
  const total = money(str(fd, "amount"));
  const methodRaw = str(fd, "method");
  const method = (methodRaw in PAYMENT_METHODS ? methodRaw : "transfer") as Method;
  const statusRaw = str(fd, "status");
  const status = (statusRaw in PAYMENT_STATUS ? statusRaw : "pending") as Status;
  const n = Math.min(24, Math.max(1, Math.round(Number(str(fd, "installments")) || 1)));
  const firstDate = dateOf(str(fd, "date")) ?? new Date();
  if (!contactId) return { ok: false, error: "Escolha o contacto." };
  if (!product) return { ok: false, error: "Indique o produto ou serviço." };
  if (!Number.isFinite(total) || total <= 0) return { ok: false, error: "Valor inválido." };
  const [contact] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) return { ok: false, error: "Contacto não encontrado." };

  let receipt: Awaited<ReturnType<typeof attachReceipt>> = null;
  try {
    receipt = await attachReceipt(fd);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Divide em cêntimos; a última parcela absorve o arredondamento
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / n);
  const planRef = n > 1 ? crypto.randomUUID() : null;
  for (let i = 0; i < n; i++) {
    const due = new Date(firstDate.getFullYear(), firstDate.getMonth() + i, firstDate.getDate(), 12);
    // Só a primeira parcela herda o estado escolhido; as seguintes ficam pendentes até à data
    const st: Status = i === 0 ? status : "pending";
    await db.insert(payments).values({
      contactId,
      product,
      amount: ((i === n - 1 ? cents - each * (n - 1) : each) / 100).toFixed(2),
      method,
      status: st,
      reference: str(fd, "reference") || null,
      notes: str(fd, "notes") || null,
      dueDate: st === "pending" ? due : null,
      paidAt: isPaid(st) ? due : null,
      installment: n > 1 ? i + 1 : null,
      installments: n > 1 ? n : null,
      planRef,
      ...(i === 0 ? receipt : {}),
    });
  }
  await addInteraction(
    contactId,
    "purchase",
    n > 1
      ? `Plano de pagamento: ${product} — ${eur(total)} em ${n} parcelas via ${PAYMENT_METHODS[method]}.`
      : `Pagamento registado: ${product} — ${eur(total)} via ${PAYMENT_METHODS[method]} (${PAYMENT_STATUS[status].label}).`
  );
  if (isPaid(status)) await tagContact(contactId, `Comprador ${product}`, "#a855f7");
  refresh(contactId);
  return { ok: true, savedAt: Date.now() };
}

export async function updatePaymentAction(id: number, _prev: FinanceResult | null, fd: FormData): Promise<FinanceResult> {
  await requireAdmin();
  const [p] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!p) return { ok: false, error: "Pagamento não encontrado." };
  const amount = money(str(fd, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Valor inválido." };
  const product = str(fd, "product");
  if (!product) return { ok: false, error: "Indique o produto ou serviço." };
  const statusRaw = str(fd, "status");
  const status = (statusRaw in PAYMENT_STATUS ? statusRaw : p.status) as Status;
  const methodRaw = str(fd, "method");
  const date = dateOf(str(fd, "date"));

  let receipt: Awaited<ReturnType<typeof attachReceipt>> = null;
  try {
    receipt = await attachReceipt(fd);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (receipt && p.receiptFile) await fs.rm(filePath(p.receiptFile, "comprovativos"), { force: true });

  await db
    .update(payments)
    .set({
      product,
      amount: amount.toFixed(2),
      method: (methodRaw in PAYMENT_METHODS ? methodRaw : p.method) as Method,
      status,
      reference: str(fd, "reference") || null,
      notes: str(fd, "notes") || null,
      // A data do formulário é o vencimento (pendente) ou a data de recebimento (pago)
      dueDate: status === "pending" ? (date ?? p.dueDate) : p.dueDate,
      paidAt: isPaid(status) ? (date ?? p.paidAt ?? new Date()) : null,
      ...receipt,
    })
    .where(eq(payments.id, id));
  if (status !== p.status) {
    await addInteraction(p.contactId, "system", `Pagamento ${product} (${eur(amount)}) → ${PAYMENT_STATUS[status].label}.`);
  }
  refresh(p.contactId);
  return { ok: true, savedAt: Date.now() };
}

/** Marca como recebido hoje. */
export async function markPaid(id: number) {
  await requireAdmin();
  const [p] = await db
    .update(payments)
    .set({ status: "confirmed", paidAt: new Date() })
    .where(eq(payments.id, id))
    .returning();
  if (p) {
    await addInteraction(p.contactId, "purchase", `Pagamento recebido: ${p.product} — ${eur(p.amount)}.`);
    await tagContact(p.contactId, `Comprador ${p.product}`, "#a855f7");
    refresh(p.contactId);
  }
}

export async function deletePayment(id: number) {
  await requireAdmin();
  const [p] = await db.delete(payments).where(eq(payments.id, id)).returning();
  if (!p) return;
  if (p.receiptFile) await fs.rm(filePath(p.receiptFile, "comprovativos"), { force: true });
  await addInteraction(p.contactId, "system", `Pagamento apagado: ${p.product} — ${eur(p.amount)}.`);
  refresh(p.contactId);
}

/* -------------------------------- DESPESAS ------------------------------- */

function readExpense(fd: FormData) {
  const amount = money(str(fd, "amount"));
  const categoryRaw = str(fd, "category");
  return {
    description: str(fd, "description"),
    category: categoryRaw in EXPENSE_CATEGORIES ? categoryRaw : "Outros",
    amount,
    date: dateOf(str(fd, "date")) ?? new Date(),
    supplier: str(fd, "supplier") || null,
    recurring: fd.get("recurring") === "1",
    notes: str(fd, "notes") || null,
  };
}

export async function createExpenseAction(_prev: FinanceResult | null, fd: FormData): Promise<FinanceResult> {
  await requireAdmin();
  const e = readExpense(fd);
  if (!e.description) return { ok: false, error: "Indique a descrição." };
  if (!Number.isFinite(e.amount) || e.amount <= 0) return { ok: false, error: "Valor inválido." };
  let receipt: Awaited<ReturnType<typeof attachReceipt>> = null;
  try {
    receipt = await attachReceipt(fd);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  await db.insert(expenses).values({ ...e, amount: e.amount.toFixed(2), ...receipt });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function updateExpenseAction(id: number, _prev: FinanceResult | null, fd: FormData): Promise<FinanceResult> {
  await requireAdmin();
  const [old] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!old) return { ok: false, error: "Despesa não encontrada." };
  const e = readExpense(fd);
  if (!e.description) return { ok: false, error: "Indique a descrição." };
  if (!Number.isFinite(e.amount) || e.amount <= 0) return { ok: false, error: "Valor inválido." };
  let receipt: Awaited<ReturnType<typeof attachReceipt>> = null;
  try {
    receipt = await attachReceipt(fd);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (receipt && old.receiptFile) await fs.rm(filePath(old.receiptFile, "comprovativos"), { force: true });
  await db.update(expenses).set({ ...e, amount: e.amount.toFixed(2), ...receipt }).where(eq(expenses.id, id));
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function deleteExpense(id: number) {
  await requireAdmin();
  const [e] = await db.delete(expenses).where(eq(expenses.id, id)).returning();
  if (e?.receiptFile) await fs.rm(filePath(e.receiptFile, "comprovativos"), { force: true });
  refresh();
}

/** Lança uma despesa recorrente no mês actual (cópia com a data de hoje). */
export async function repeatExpense(id: number) {
  await requireAdmin();
  const [e] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!e) return;
  await db.insert(expenses).values({
    description: e.description,
    category: e.category,
    amount: e.amount,
    supplier: e.supplier,
    recurring: e.recurring,
    notes: e.notes,
    date: new Date(),
  });
  refresh();
}
