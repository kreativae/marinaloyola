import type { ReactNode } from "react";
import { cn, num } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-plum">
          Marina Loyola · Gestão
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-zinc-950 lg:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
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
        "card relative overflow-hidden p-5",
        accent && "border-plum/30 bg-plum/[0.04]"
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        {icon && <span className={cn("text-zinc-500", accent && "text-plum")}>{icon}</span>}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-zinc-950">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-6", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between">
          {title && (
            <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              {title}
            </h2>
          )}
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

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
      {text}
    </p>
  );
}

export function BarChart({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-3">
        {data.map((d) => (
          <div key={d.label} className="group flex h-full flex-1 flex-col justify-end">
            <p className="mb-1.5 text-center text-[11px] font-semibold text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
              {format ? format(d.value) : num(d.value)}
            </p>
            <div
              className="w-full rounded-t-lg bg-plum/80 transition-all duration-500 group-hover:bg-plum"
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 6 : 1.5)}%` }}
              title={`${d.label}: ${format ? format(d.value) : num(d.value)}`}
            />
            <p className="mt-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {d.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarRow({
  label,
  value,
  total,
  display,
}: {
  label: string;
  value: number;
  total: number;
  display: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">{label}</span>
        <span className="font-semibold text-zinc-800">{display}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-plum/70 transition-all duration-700"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-200/70">
      <div
        className="h-full rounded-full bg-plum transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}
