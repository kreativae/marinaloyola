"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Peças partilhadas pelos formulários do backoffice: janela modal com cabeçalho e rodapé fixo,
 * secções com ícone, campos com ícone, escolhas em pílulas e valores em destaque.
 */

/* --------------------------------- MODAL --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // O diálogo foca o primeiro botão (fechar); um campo com data-autofocus fica com o cursor
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[calc(100%-1.5rem)] overflow-hidden rounded-[26px] border border-line bg-white p-0 text-left text-zinc-900 shadow-[0_40px_100px_-30px_rgb(24_24_27/0.5)] backdrop:bg-zinc-950/35 backdrop:backdrop-blur-sm",
        size === "lg" ? "max-w-2xl" : "max-w-xl"
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="relative flex items-start gap-4 border-b border-line bg-zinc-50/70 px-6 py-5">
            {Icon && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-plum text-white shadow-[0_10px_24px_-10px_rgb(128_0_128/0.8)]">
                <Icon size={19} />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="truncate font-display text-[1.45rem] leading-tight tracking-[-0.01em] text-zinc-950">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 rounded-xl p-2 text-zinc-400 transition-colors hover:bg-white hover:text-zinc-900"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </header>
          <div className="admin-scroll flex-1 overflow-y-auto px-6 pt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Rodapé do formulário, sempre visível no fundo da janela. */
export function ModalFooter({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-6 border-t border-line bg-white/95 px-6 py-4 backdrop-blur">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/* -------------------------------- SECÇÕES -------------------------------- */

export function FormSection({ icon: Icon, title, children, aside }: { icon: LucideIcon; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-plum/[0.08] text-plum">
          <Icon size={14} />
        </span>
        <h3 className="text-[13px] font-semibold text-zinc-900">{title}</h3>
        <span className="h-px flex-1 bg-line" />
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* -------------------------------- CAMPOS --------------------------------- */

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold text-zinc-600">
        {label}
        {required && <span className="text-plum">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-zinc-400">{hint}</p>}
    </div>
  );
}

/** Campo com ícone à esquerda. */
export function IconInput({ icon: Icon, children, suffix }: { icon: LucideIcon; children: ReactNode; suffix?: ReactNode }) {
  return (
    <div className="group relative">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-plum" />
      <div className="[&_input]:!pl-10 [&_select]:!pl-10">{children}</div>
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">{suffix}</span>}
    </div>
  );
}

/** Valor em euros em destaque. */
export function MoneyInput({ name, defaultValue, value, onChange, required }: { name: string; defaultValue?: string; value?: string; onChange?: (v: string) => void; required?: boolean }) {
  return (
    <div className="group relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-zinc-300 transition-colors group-focus-within:text-plum">€</span>
      <input
        name={name}
        inputMode="decimal"
        required={required}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder="0,00"
        className="field !h-12 !pl-10 font-display !text-xl tabular-nums tracking-tight"
      />
    </div>
  );
}

/* ------------------------------- ESCOLHAS -------------------------------- */

export type PillOption = { value: string; label: string; color?: string; icon?: LucideIcon; className?: string };

/**
 * Escolha única em pílulas (rádios escondidos: o valor segue no FormData com o `name`).
 * Com `color`, a pílula activa usa essa cor; com `className`, usa essas classes.
 */
export function PillGroup({
  name,
  options,
  defaultValue,
  value: controlled,
  onChange,
  size = "md",
}: {
  name: string;
  options: PillOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  size?: "sm" | "md";
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const value = controlled ?? inner;
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border font-semibold transition-all duration-200",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-xs",
              on
                ? o.className ?? (o.color ? "text-white shadow-sm" : "border-plum bg-plum text-white shadow-[0_6px_14px_-8px_rgb(128_0_128/0.8)]")
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            )}
            style={on && o.color && !o.className ? { background: o.color, borderColor: o.color } : undefined}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => {
                setInner(o.value);
                onChange?.(o.value);
              }}
              className="sr-only"
            />
            {o.icon ? (
              <o.icon size={13} />
            ) : o.color && !on ? (
              <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
            ) : on ? (
              <Check size={12} />
            ) : null}
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/** Interruptor com texto, para opções sim/não. */
export function ToggleRow({ name, label, description, defaultChecked }: { name: string; label: string; description?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3 transition-colors hover:bg-zinc-50/60">
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-plum peer-checked:after:translate-x-4" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-800">{label}</span>
        {description && <span className="block text-xs text-zinc-500">{description}</span>}
      </span>
    </label>
  );
}
