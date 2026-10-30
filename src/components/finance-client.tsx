"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Hash,
  Landmark,
  Loader2,
  Package,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  Receipt,
  Repeat,
  Save,
  ShoppingBag,
  Smartphone,
  Trash2,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
import { Field, FormSection, IconInput, Modal, ModalFooter, MoneyInput, PillGroup, ToggleRow } from "@/components/form-kit";
import { EXPENSE_CATEGORIES } from "@/lib/finance-def";
import { cn, eur, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/utils";

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
    <ModalFooter error={error}>
      <button type="button" onClick={onCancel} className="btn-ghost !px-5 !py-2.5 !text-xs">
        Cancelar
      </button>
      <button type="submit" disabled={pending} className="btn-primary !px-6 !py-2.5 !text-xs disabled:opacity-60">
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {submit}
      </button>
    </ModalFooter>
  );
}

function ReceiptField({ current, href }: { current?: string | null; href?: string }) {
  const [file, setFile] = useState<string | null>(null);
  return (
    <div>
      <label className="group flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 px-4 py-3.5 transition-colors hover:border-plum/40 hover:bg-plum/[0.03]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-plum/10 group-hover:text-plum">
          <Paperclip size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-800">{file ?? (current ? "Substituir comprovativo" : "Anexar comprovativo")}</span>
          <span className="block text-xs text-zinc-500">PDF ou imagem · fica privado, só a equipa vê</span>
        </span>
        <input type="file" name="receipt" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} className="sr-only" />
      </label>
      {current && !file && (
        <p className="mt-1.5 text-xs text-zinc-500">
          Actual:{" "}
          <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-plum hover:underline">
            {current}
          </a>
        </p>
      )}
    </div>
  );
}

const METHOD_ICONS: Record<string, LucideIcon> = { mbway: Smartphone, transfer: Landmark, hotmart: ShoppingBag, other: Wallet };
const PAY_STATUS_COLORS: Record<string, string> = {
  pending: "#d97706",
  confirmed: "#059669",
  completed: "#047857",
  refunded: "#71717a",
  cancelled: "#e11d48",
};

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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={payment ? "Editar recebimento" : "Novo recebimento"}
        description={payment ? payment.product : "Pagamento por MBWay, transferência ou outro método"}
        icon={Wallet}
        size="lg"
      >
        <form onSubmit={onSubmit}>
          <FormSection icon={ShoppingBag} title="O quê e quem">
            {!payment && (
              <Field label="Contacto" required>
                <IconInput icon={UserRound}>
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
                </IconInput>
              </Field>
            )}
            <Field label="Produto ou serviço" required>
              <IconInput icon={Package}>
                <input name="product" list="finance-products" required defaultValue={payment?.product} placeholder="Ex: Mentoria Design Business" className="field" />
              </IconInput>
              <datalist id="finance-products">
                {products.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
          </FormSection>

          <FormSection icon={Banknote} title="Valor e pagamento">
            <Field label={payment ? "Valor" : "Valor total"} required>
              <MoneyInput name="amount" required value={amount} onChange={setAmount} />
            </Field>
            <Field label="Método">
              <PillGroup
                name="method"
                defaultValue={payment?.method ?? "mbway"}
                options={Object.entries(PAYMENT_METHODS).map(([v, l]) => ({ value: v, label: l, icon: METHOD_ICONS[v] }))}
              />
            </Field>
            <Field label="Estado">
              <PillGroup
                name="status"
                value={status}
                onChange={setStatus}
                options={Object.entries(PAYMENT_STATUS).map(([v, st]) => ({ value: v, label: st.label, color: PAY_STATUS_COLORS[v] }))}
              />
            </Field>
          </FormSection>

          <FormSection icon={CalendarDays} title={payment ? "Data" : "Data e parcelas"}>
            <Field label={paid ? "Recebido em" : installments > 1 ? "1.º vencimento" : "Vencimento"}>
              <IconInput icon={CalendarDays}>
                <input name="date" type="date" defaultValue={payment ? isoDate(paid ? payment.paidAt : payment.dueDate) : today()} className="field" />
              </IconInput>
            </Field>
            {!payment && (
              <Field label="Dividir em parcelas">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 2, 3, 4, 6, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(n)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-xs font-semibold transition-all",
                        installments === n ? "border-plum bg-plum text-white shadow-[0_6px_14px_-8px_rgb(128_0_128/0.8)]" : "border-zinc-200 bg-white text-zinc-600 hover:border-plum/40"
                      )}
                    >
                      {n === 1 ? "À vista" : `${n}×`}
                    </button>
                  ))}
                  <input type="hidden" name="installments" value={installments} />
                </div>
                {installments > 1 && total > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {Array.from({ length: installments }, (_, i) => (
                      <div key={i} className={cn("rounded-xl border px-2 py-2 text-center", i === 0 ? "border-plum/30 bg-plum/[0.05]" : "border-line bg-zinc-50/60")}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{i + 1}/{installments}</p>
                        <p className="text-xs font-semibold tabular-nums text-zinc-800">{eur(Math.floor((total * 100) / installments) / 100)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            )}
          </FormSection>

          <FormSection icon={FileText} title="Comprovativo e notas">
            <ReceiptField current={payment?.receiptName} href={payment ? `/api/comprovativos/pagamento/${payment.id}` : undefined} />
            <Field label="Referência">
              <IconInput icon={Hash}>
                <input name="reference" defaultValue={payment?.reference ?? ""} placeholder="N.º MBWay, IBAN, transação…" className="field" />
              </IconInput>
            </Field>
            <Field label="Notas">
              <textarea name="notes" rows={2} defaultValue={payment?.notes ?? ""} className="field resize-y" />
            </Field>
          </FormSection>

          <Footer pending={pending} error={state?.error} onCancel={() => setOpen(false)} submit={payment ? "Guardar" : "Registar recebimento"} />
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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={expense ? "Editar despesa" : "Nova despesa"}
        description="Custos do negócio, para calcular o lucro"
        icon={Receipt}
        size="lg"
      >
        <form onSubmit={onSubmit}>
          <FormSection icon={Receipt} title="Despesa">
            <Field label="Descrição" required>
              <IconInput icon={PenLine}>
                <input name="description" required defaultValue={expense?.description} placeholder="Ex: Assinatura Adobe" className="field" />
              </IconInput>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor" required>
                <MoneyInput name="amount" required defaultValue={expense ? String(expense.amount).replace(".", ",") : ""} />
              </Field>
              <Field label="Data">
                <IconInput icon={CalendarDays}>
                  <input name="date" type="date" defaultValue={expense ? isoDate(expense.date) : today()} className="field !h-12" />
                </IconInput>
              </Field>
            </div>
            <Field label="Categoria">
              <PillGroup
                name="category"
                size="sm"
                defaultValue={expense?.category ?? "Software & ferramentas"}
                options={Object.entries(EXPENSE_CATEGORIES).map(([c, color]) => ({ value: c, label: c, color }))}
              />
            </Field>
            <Field label="Fornecedor">
              <IconInput icon={Building2}>
                <input name="supplier" defaultValue={expense?.supplier ?? ""} placeholder="Opcional" className="field" />
              </IconInput>
            </Field>
          </FormSection>

          <FormSection icon={Repeat} title="Recorrência e comprovativo">
            <ToggleRow name="recurring" label="Despesa mensal" description="Assinaturas, contabilidade, renda… aparece o atalho “Lançar este mês”." defaultChecked={expense?.recurring} />
            <ReceiptField current={expense?.receiptName} href={expense ? `/api/comprovativos/despesa/${expense.id}` : undefined} />
            <Field label="Notas">
              <textarea name="notes" rows={2} defaultValue={expense?.notes ?? ""} className="field resize-y" />
            </Field>
          </FormSection>

          <Footer pending={pending} error={state?.error} onCancel={() => setOpen(false)} submit={expense ? "Guardar" : "Registar despesa"} />
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
