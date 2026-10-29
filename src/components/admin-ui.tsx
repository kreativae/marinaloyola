import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { cn, num } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow = "Marina Loyola · Gestão",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5 animate-[rise_0.6s_var(--ease-out-soft)_backwards]">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.3em] text-plum">
          <span className="h-px w-6 bg-plum/40" />
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-[2rem] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-950 lg:text-[2.6rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "card card-hover group relative overflow-hidden p-5",
        accent && "!border-plum-deep bg-[#2a0a2e] text-white"
      )}
    >
      {/* Brilho discreto que segue o hover */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          accent ? "bg-plum-bright/30" : "bg-plum/10"
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[10.5px] font-bold uppercase tracking-[0.18em]",
            accent ? "text-white/60" : "text-zinc-400"
          )}
        >
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110",
              accent ? "bg-white/10 text-white" : "bg-plum/[0.07] text-plum"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          "relative mt-2 font-display text-[2rem] font-medium leading-none tracking-[-0.02em]",
          accent ? "text-white" : "text-zinc-950"
        )}
      >
        <CountUp value={value} />
      </p>
      {hint && <p className={cn("relative mt-2.5 text-xs", accent ? "text-white/60" : "text-zinc-500")}>{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-6", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ label, className }: { label: string; className?: string }) {
  return <span className={cn("chip border-zinc-200 bg-zinc-100 text-zinc-600", className)}>{label}</span>;
}

export function EmptyState({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-9 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-900/5">
        {icon ?? <Inbox size={18} />}
      </span>
      <p className="max-w-xs text-sm text-zinc-500">{text}</p>
    </div>
  );
}

/** Colunas verticais; a última (período actual) fica em destaque. */
export function BarChart({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const show = (n: number) => (format ? format(n) : num(n));
  return (
    <div className="relative">
      {/* Linhas de grelha */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-t border-dashed border-zinc-200/80" />
        ))}
      </div>
      <div className={cn("relative flex h-52 items-end", data.length > 8 ? "gap-1 sm:gap-1.5" : "gap-3 sm:gap-4")}>
        {data.map((d, i) => {
          const last = i === data.length - 1;
          return (
            <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
              <p
                className={cn(
                  "mb-2 whitespace-nowrap text-center text-[11px] font-semibold tabular-nums transition-all duration-300",
                  last ? "text-plum" : "translate-y-1 text-zinc-500 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                )}
              >
                {show(d.value)}
              </p>
              <div
                className={cn(
                  "grow-y w-full rounded-[10px] transition-colors duration-300",
                  last ? "bg-plum" : "bg-plum/15 group-hover:bg-plum/35"
                )}
                style={{
                  height: `${Math.max((d.value / max) * 82, d.value > 0 ? 5 : 1.5)}%`,
                  animationDelay: `${i * 70}ms`,
                }}
                title={`${d.label}: ${show(d.value)}`}
              />
              <p
                className={cn(
                  "mt-3 truncate text-center text-[10px] font-bold uppercase",
                  data.length > 8 ? "tracking-normal" : "tracking-[0.14em]",
                  last ? "text-zinc-900" : "text-zinc-400"
                )}
              >
                {d.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HBarRow({
  label,
  value,
  total,
  display,
  color,
}: {
  label: string;
  value: number;
  total: number;
  display: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="group">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-zinc-600 transition-colors group-hover:text-zinc-950">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-zinc-900">
          {display}
          <span className="ml-2 text-[11px] font-medium text-zinc-400">{pct}%</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="grow-x h-full rounded-full"
          style={{ width: `${Math.max(pct, 2)}%`, background: color ?? "var(--color-plum)" }}
        />
      </div>
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-200/70">
      <div className="grow-x h-full rounded-full bg-plum" style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

/** Receitas e despesas lado a lado por mês, com o resultado (lucro) por baixo. */
export function CashflowChart({
  data,
  format,
}: {
  data: { label: string; income: number; expense: number }[];
  format: (n: number) => string;
}) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  return (
    <div>
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-zinc-200/80" />
          ))}
        </div>
        <div className="relative flex h-52 items-end gap-2 sm:gap-3">
          {data.map((d, i) => {
            const last = i === data.length - 1;
            return (
              <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center gap-[3px]">
                {/* Detalhe ao passar o rato */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 translate-y-1 rounded-xl bg-zinc-900 px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="font-semibold capitalize">{d.label}</p>
                  <p>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-plum-soft" />
                    Receita {format(d.income)}
                  </p>
                  <p>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-zinc-400" />
                    Despesas {format(d.expense)}
                  </p>
                  <p className={cn("font-semibold", d.income - d.expense >= 0 ? "text-emerald-300" : "text-rose-300")}>
                    Resultado {format(d.income - d.expense)}
                  </p>
                </div>
                <div
                  className={cn("grow-y w-full max-w-[26px] rounded-t-[8px] transition-colors", last ? "bg-plum" : "bg-plum/30 group-hover:bg-plum/60")}
                  style={{ height: `${Math.max((d.income / max) * 92, d.income > 0 ? 3 : 1)}%`, animationDelay: `${i * 50}ms` }}
                />
                <div
                  className={cn("grow-y w-full max-w-[26px] rounded-t-[8px] transition-colors", last ? "bg-zinc-400" : "bg-zinc-200 group-hover:bg-zinc-300")}
                  style={{ height: `${Math.max((d.expense / max) * 92, d.expense > 0 ? 3 : 1)}%`, animationDelay: `${i * 50 + 80}ms` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2.5 flex gap-2 sm:gap-3">
        {data.map((d, i) => {
          const r = d.income - d.expense;
          return (
            <div key={d.label} className="flex-1 text-center">
              <p className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", i === data.length - 1 ? "text-zinc-900" : "text-zinc-400")}>
                {d.label}
              </p>
              <p className={cn("mt-0.5 hidden text-[10px] font-semibold tabular-nums sm:block", r > 0 ? "text-emerald-600" : r < 0 ? "text-rose-500" : "text-zinc-300")}>
                {r === 0 ? "—" : `${r > 0 ? "+" : ""}${format(r).replace(/,\d\d\s?€$/, " €")}`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-plum" /> Receita recebida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" /> Despesas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-emerald-600">+ €</span> Resultado do mês
        </span>
      </div>
    </div>
  );
}
