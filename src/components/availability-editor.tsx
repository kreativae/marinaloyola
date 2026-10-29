"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Coffee, Loader2, Plus, X } from "lucide-react";
import { saveAvailability } from "@/lib/actions-admin";
import { cn } from "@/lib/utils";

export type DayHours = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  active: boolean;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Escala da barra visual: 06:00–22:00
const SCALE_START = 360;
const SCALE_LEN = 960;
const pos = (m: number) => Math.min(100, Math.max(0, ((m - SCALE_START) / SCALE_LEN) * 100));

/**
 * Um dia do horário semanal. Cada alteração grava sozinha (sem botão):
 * o interruptor de imediato, as horas pouco depois de parar de escrever.
 */
export function DayHoursRow({ day }: { day: DayHours }) {
  const [v, setV] = useState(day);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const hide = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    window.clearTimeout(hide.current);
  }, []);

  const save = (next: DayHours, delay = 0) => {
    setV(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setStatus("saving");
      start(async () => {
        const r = await saveAvailability(next.id, {
          startTime: next.startTime,
          endTime: next.endTime,
          active: next.active,
          breakStart: next.breakStart,
          breakEnd: next.breakEnd,
        });
        if (r.ok) {
          setError(null);
          setStatus("saved");
          window.clearTimeout(hide.current);
          hide.current = window.setTimeout(() => setStatus("idle"), 2200);
        } else {
          setError(r.error ?? "Não foi possível guardar.");
          setStatus("error");
        }
      });
    }, delay);
  };

  const addBreak = () => {
    // Por omissão 13:00–14:00, ajustado para caber dentro do horário do dia
    const s = toMin(v.startTime);
    const e = toMin(v.endTime);
    let bs = Math.max(780, s + 60);
    if (bs + 60 >= e) bs = Math.floor((s + e) / 2 / 15) * 15 - 30;
    save({ ...v, breakStart: toTime(bs), breakEnd: toTime(bs + 60) });
  };

  const s = toMin(v.startTime);
  const e = toMin(v.endTime);
  const hasBreak = Boolean(v.breakStart && v.breakEnd);
  const time = "field !w-[92px] !px-2.5 !py-1.5 !text-sm disabled:opacity-50";

  return (
    <li
      className={cn(
        "rounded-2xl border px-4 py-3 transition-colors",
        status === "error" ? "border-rose-200 bg-rose-50/40" : v.active ? "border-line bg-white" : "border-dashed border-zinc-200 bg-zinc-50/60"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(ev) => save({ ...v, active: ev.target.checked })}
            className="peer sr-only"
          />
          <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-plum peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-plum/30" />
          <span className={cn("text-sm font-semibold", v.active ? "text-zinc-900" : "text-zinc-400")}>{v.label}</span>
        </label>

        {v.active ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label={`${v.label}: início`}
              value={v.startTime}
              onChange={(ev) => ev.target.value && save({ ...v, startTime: ev.target.value }, 700)}
              className={time}
            />
            <span className="text-zinc-300">—</span>
            <input
              type="time"
              aria-label={`${v.label}: fim`}
              value={v.endTime}
              onChange={(ev) => ev.target.value && save({ ...v, endTime: ev.target.value }, 700)}
              className={time}
            />
          </div>
        ) : (
          <span className="text-sm text-zinc-400">Indisponível</span>
        )}

        {/* Barra do dia, com o intervalo em falta */}
        <div className="relative hidden h-1.5 min-w-[70px] flex-1 overflow-hidden rounded-full bg-zinc-100 md:block">
          {v.active && e > s && (
            <span
              className="absolute inset-y-0 rounded-full bg-plum/70 transition-all duration-500"
              style={{ left: `${pos(s)}%`, width: `${Math.max(2, pos(e) - pos(s))}%` }}
            />
          )}
          {v.active && hasBreak && (
            <span
              className="absolute inset-y-0 bg-zinc-100 transition-all duration-500"
              style={{
                left: `${pos(toMin(v.breakStart!))}%`,
                width: `${Math.max(1, pos(toMin(v.breakEnd!)) - pos(toMin(v.breakStart!)))}%`,
              }}
            />
          )}
        </div>

        <span className="ml-auto flex h-6 min-w-[86px] items-center justify-end text-xs font-semibold">
          {status === "saving" && (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Loader2 size={13} className="animate-spin" /> A guardar
            </span>
          )}
          {status === "saved" && (
            <span className="pop flex items-center gap-1 text-emerald-600">
              <Check size={14} /> Guardado
            </span>
          )}
        </span>
      </div>

      {v.active && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[124px] max-sm:pl-0">
          {hasBreak ? (
            <>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Coffee size={14} /> Intervalo
              </span>
              <input
                type="time"
                aria-label={`${v.label}: início do intervalo`}
                value={v.breakStart ?? ""}
                onChange={(ev) => ev.target.value && save({ ...v, breakStart: ev.target.value }, 700)}
                className={cn(time, "!w-[86px] !py-1 !text-xs")}
              />
              <span className="text-zinc-300">—</span>
              <input
                type="time"
                aria-label={`${v.label}: fim do intervalo`}
                value={v.breakEnd ?? ""}
                onChange={(ev) => ev.target.value && save({ ...v, breakEnd: ev.target.value }, 700)}
                className={cn(time, "!w-[86px] !py-1 !text-xs")}
              />
              <button
                type="button"
                onClick={() => save({ ...v, breakStart: null, breakEnd: null })}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remover intervalo"
                title="Remover intervalo"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={addBreak}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 transition-colors hover:bg-amber-50 hover:text-amber-700"
            >
              <Plus size={13} /> Adicionar intervalo
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
    </li>
  );
}

/** Aplica o mesmo horário e intervalo aos dias úteis activos. */
export function CopyToWeekdays({ days }: { days: DayHours[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const monday = days.find((d) => d.label.toLowerCase().startsWith("segunda"));
  if (!monday) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Aplicar o horário de segunda (${monday.startTime}–${monday.endTime}${monday.breakStart ? `, intervalo ${monday.breakStart}–${monday.breakEnd}` : ""}) de terça a sexta?`)) return;
        start(async () => {
          const weekdays = days.filter((d) => /^(terça|quarta|quinta|sexta)/i.test(d.label));
          for (const d of weekdays) {
            await saveAvailability(d.id, {
              startTime: monday.startTime,
              endTime: monday.endTime,
              active: true,
              breakStart: monday.breakStart,
              breakEnd: monday.breakEnd,
            });
          }
          setDone(true);
          window.location.reload();
        });
      }}
      className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-plum disabled:opacity-50"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : done ? <Check size={13} /> : null}
      Copiar segunda para dias úteis
    </button>
  );
}
