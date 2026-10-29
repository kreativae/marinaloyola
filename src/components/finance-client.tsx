"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Paperclip, Pencil, Plus, Repeat, Save, Trash2 } from "lucide-react";
import {
  createExpenseAction,
  createPaymentAction,
  deleteExpense,
  deletePayment,
  markPaid,
  repeatExpense,
  updateExpenseAction,
  updatePaymentAction,
  type FinanceResult,
} from "@/lib/actions-finance";
import { Modal } from "@/components/contacts-client";
import { EXPENSE_CATEGORIES } from "@/lib/finance-def";
import { cn, eur, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/utils";

const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";
const iconBtn =
  "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-plum disabled:pointer-events-none disabled:opacity-40";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Submissão manual (não limpa o formulário num erro); fecha ao guardar. */
function useFinanceForm(
  action: (prev: FinanceResult | null, fd: FormData) => Promise<FinanceResult>,
  onDone: () => void
) {
  const [state, run, pending] = useActionState(async (prev: FinanceResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) onDone();
    return r;
  }, null);
  return {
    state,
    pending,
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => run(fd));
    },
  };
}

function Footer({ pending, error, onCancel, submit }: { pending: boolean; error?: string; onCancel: () => void; submit: string }) {
  return (
    <>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost !px-5 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {submit}
        </button>
      </div>
    </>
  );
}

function ReceiptField({ current, href }: { current?: string | null; href?: string }) {
  return (
    <div>
      <label className={label}>Comprovativo</label>
      <input
        type="file"
        name="receipt"
        accept=".pdf,image/*"
        className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-full file:border-0 file:bg-plum/[0.08] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-plum hover:file:bg-plum/15"
      />
      {current && (
        <p className="mt-1.5 text-xs text-zinc-500">
          Actual:{" "}
          <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-plum hover:underline">
            {current}
          </a>{" "}
          — escolha outro para substituir.
        </p>
      )}
    </div>
  );
}

/* ------------------------------ RECEBIMENTOS ----------------------------- */

export type PaymentRow = {
  id: number;
  contactId: number;
  product: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  dueDate: string | null;
  paidAt: string | null;
  receiptName: string | null;
};

export function PaymentFormButton({
  contacts,
  products,
  payment,
  defaultOpen = false,
  trigger,
}: {
  contacts: { id: number; name: string }[];
  products: string[];
  payment?: PaymentRow;
  defaultOpen?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState(payment?.status ?? "confirmed");
  const [installments, setInstallments] = useState(1);
  const [amount, setAmount] = useState(payment ? String(payment.amount).replace(".", ",") : "");
  const { state, pending, onSubmit } = useFinanceForm(
    payment ? updatePaymentAction.bind(null, payment.id) : createPaymentAction,
    () => setOpen(false)
  );
  const paid = status === "confirmed" || status === "completed";
  const total = Number(amount.replace(/\./g, "").replace(",", ".")) || 0;

  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className="contents">
          {trigger}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 !text-xs">
          <Plus size={14} /> Recebimento
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={payment ? "Editar recebimento" : "Novo recebimento"}>
        <form onSubmit={onSubmit} className="space-y-4">
          {!payment && (
            <div>
              <label className={label}>Contacto *</label>
              <select name="contactId" required defaultValue="" className="field">
                <option value="" disabled>
                  Escolha o contacto…
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={label}>Produto ou serviço *</label>
            <input name="product" list="finance-products" required defaultValue={payment?.product} placeholder="Ex: Mentoria Design Business" className="field" />
            <datalist id="finance-products">
              {products.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>{payment ? "Valor *" : "Valor total *"}</label>
              <div className="relative">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="field !pr-9 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">€</span>
              </div>
            </div>
            <div>
              <label className={label}>Método</label>
              <select name="method" defaultValue={payment?.method ?? "mbway"} className="field">
                {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Estado</label>
              <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field">
                {Object.entries(PAYMENT_STATUS).map(([v, s]) => (
                  <option key={v} value={v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{paid ? "Recebido em" : installments > 1 ? "1.º vencimento" : "Vencimento"}</label>
              <input
                name="date"
                type="date"
                defaultValue={payment ? isoDate(paid ? payment.paidAt : payment.dueDate) : today()}
                className="field"
              />
            </div>
          </div>
          {!payment && (
            <div className="rounded-2xl border border-line bg-zinc-50/60 p-4">
              <label className={label}>Dividir em parcelas</label>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4, 6, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setInstallments(n)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      installments === n ? "border-plum bg-plum text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-plum/40"
                    )}
                  >
                    {n === 1 ? "À vista" : `${n}×`}
                  </button>
                ))}
                <input type="hidden" name="installments" value={installments} />
              </div>
              {installments > 1 && total > 0 && (
                <p className="mt-3 text-xs text-zinc-600">
                  {installments} parcelas mensais de <b>{eur(Math.floor((total * 100) / installments) / 100)}</b>. A primeira fica
                  como “{PAYMENT_STATUS[status]?.label}”; as restantes ficam pendentes, com vencimento todos os meses.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Referência</label>
              <input name="reference" defaultValue={payment?.reference ?? ""} placeholder="N.º MBWay, IBAN, transação…" className="field" />
            </div>
            <ReceiptField current={payment?.receiptName} href={payment ? `/api/comprovativos/pagamento/${payment.id}` : undefined} />
          </div>
          <div>
            <label className={label}>Notas</label>
            <textarea name="notes" rows={2} defaultValue={payment?.notes ?? ""} className="field resize-y" />
          </div>
          <Footer pending={pending} error={state?.error} onCancel={() => setOpen(false)} submit={payment ? "Guardar" : "Registar"} />
        </form>
      </Modal>
    </>
  );
}

export function PaymentActions({
  payment,
  contacts,
  products,
  compact = false,
}: {
  payment: PaymentRow;
  contacts: { id: number; name: string }[];
  products: string[];
  /** Só o botão "Recebido" (listas curtas) */
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  if (compact) {
    return payment.status === "pending" ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => markPaid(payment.id))}
        className="shrink-0 rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
        title="Marcar como recebido hoje"
        aria-label="Marcar como recebido"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
      </button>
    ) : null;
  }
  return (
    <div className="flex items-center justify-end gap-0.5">
      {payment.status === "pending" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markPaid(payment.id))}
          className="mr-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          title="Marcar como recebido hoje"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Recebido
        </button>
      )}
      {payment.receiptName && (
        <a href={`/api/comprovativos/pagamento/${payment.id}`} target="_blank" rel="noreferrer" className={iconBtn} title={`Comprovativo: ${payment.receiptName}`}>
          <Paperclip size={15} />
        </a>
      )}
      <PaymentFormButton
        payment={payment}
        contacts={contacts}
        products={products}
        trigger={
          <span className={iconBtn} title="Editar">
            <Pencil size={15} />
          </span>
        }
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm(`Apagar o pagamento de ${eur(payment.amount)} (${payment.product})?`) && start(() => deletePayment(payment.id))}
        className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
        title="Apagar"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/* -------------------------------- DESPESAS ------------------------------- */

export type ExpenseRow = {
  id: number;
  description: string;
  category: string;
  amount: number;
  date: string;
  supplier: string | null;
  recurring: boolean;
  notes: string | null;
  receiptName: string | null;
};

export function ExpenseFormButton({
  expense,
  defaultOpen = false,
  trigger,
}: {
  expense?: ExpenseRow;
  defaultOpen?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { state, pending, onSubmit } = useFinanceForm(
    expense ? updateExpenseAction.bind(null, expense.id) : createExpenseAction,
    () => setOpen(false)
  );
  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className="contents">
          {trigger}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost !px-5 !py-2.5 !text-xs">
          <Plus size={14} /> Despesa
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={expense ? "Editar despesa" : "Nova despesa"}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label}>Descrição *</label>
            <input name="description" required defaultValue={expense?.description} placeholder="Ex: Assinatura Adobe" className="field" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Categoria</label>
              <select name="category" defaultValue={expense?.category ?? "Software & ferramentas"} className="field">
                {Object.keys(EXPENSE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Valor *</label>
              <div className="relative">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={expense ? String(expense.amount).replace(".", ",") : ""}
                  placeholder="0,00"
                  className="field !pr-9 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">€</span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Data</label>
              <input name="date" type="date" defaultValue={expense ? isoDate(expense.date) : today()} className="field" />
            </div>
            <div>
              <label className={label}>Fornecedor</label>
              <input name="supplier" defaultValue={expense?.supplier ?? ""} placeholder="Opcional" className="field" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3">
            <input type="checkbox" name="recurring" value="1" defaultChecked={expense?.recurring} className="h-4 w-4 accent-[#800080]" />
            <span className="text-sm text-zinc-700">
              <b className="font-semibold">Despesa mensal</b> — assinaturas, contabilidade, renda…
            </span>
          </label>
          <ReceiptField current={expense?.receiptName} href={expense ? `/api/comprovativos/despesa/${expense.id}` : undefined} />
          <div>
            <label className={label}>Notas</label>
            <textarea name="notes" rows={2} defaultValue={expense?.notes ?? ""} className="field resize-y" />
          </div>
          <Footer pending={pending} error={state?.error} onCancel={() => setOpen(false)} submit={expense ? "Guardar" : "Registar"} />
        </form>
      </Modal>
    </>
  );
}

export function ExpenseActions({ expense, repeatable }: { expense: ExpenseRow; repeatable: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-0.5">
      {expense.recurring && repeatable && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => repeatExpense(expense.id))}
          className="mr-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-100"
          title="Lançar esta despesa no mês actual"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Repeat size={12} />} Lançar este mês
        </button>
      )}
      {expense.receiptName && (
        <a href={`/api/comprovativos/despesa/${expense.id}`} target="_blank" rel="noreferrer" className={iconBtn} title={`Comprovativo: ${expense.receiptName}`}>
          <Paperclip size={15} />
        </a>
      )}
      <ExpenseFormButton
        expense={expense}
        trigger={
          <span className={iconBtn} title="Editar">
            <Pencil size={15} />
          </span>
        }
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm(`Apagar a despesa “${expense.description}”?`) && start(() => deleteExpense(expense.id))}
        className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
        title="Apagar"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
