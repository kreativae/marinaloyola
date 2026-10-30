"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, CalendarPlus, Check, Clock, Loader2, Mail, MapPin, Move, PenLine, Phone, RefreshCw, Send, Trash2, Undo2, UserRound, Video, X } from "lucide-react";
import { setAppointmentStatus } from "@/lib/actions-admin";
import { deleteAgendaEvent, moveAgendaEvent, notifyReschedule, rescheduleAppointment, saveAgendaEvent, type AgendaEventResult } from "@/lib/actions-agenda";
import { syncGoogleCalendar } from "@/lib/actions-config";
import { SelectAction, CopyButton } from "@/components/admin-client";
import { Field, FormSection, IconInput, Modal, ModalFooter, PillGroup, ToggleRow } from "@/components/form-kit";
import { APPT_STATUS, cn } from "@/lib/utils";

/**
 * Horas já calculadas no servidor no fuso de Lisboa: o browser pode estar noutro fuso
 * e as sessões têm de aparecer à hora da Marina.
 */
export type CalEvent = {
  id: number;
  kind: "appt" | "busy" | "event";
  title: string;
  subtitle: string;
  day: string; // AAAA-MM-DD (Lisboa)
  startMin: number; // minutos desde a meia-noite nesse dia
  endMin: number;
  timeLabel: string; // "10:00–10:30"
  dateLabel: string; // "quinta-feira, 30 de outubro"
  color: string;
  status?: string;
  email?: string;
  phone?: string | null;
  notes?: string | null;
  meetingUrl?: string | null;
  contactId?: number | null;
  /** Hora da cliente quando está noutro fuso: "🇧🇷 10:00–10:30 Brasília" */
  clientLabel?: string | null;
  /** Versão curta para blocos pequenos: "🇧🇷 14:00" */
  clientShort?: string | null;
  /** Compromissos do backoffice: dados para o formulário de edição */
  draft?: AgendaEventDraft;
};

const STATUS_OPTIONS = Object.entries(APPT_STATUS).map(([value, s]) => ({ value, label: s.label }));
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HOUR_PX = 52;

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function eventsOn(events: CalEvent[], day: Date) {
  const key = isoDay(day);
  return events.filter((e) => e.day === key).sort((a, b) => a.startMin - b.startMin);
}

const canDrag = (e: CalEvent) => (e.kind === "appt" && e.status !== "cancelled") || (e.kind === "event" && !e.draft?.allDay);
const keyOf = (e: { kind: string; id: number }) => `${e.kind}:${e.id}`;
const tinted = (e: CalEvent) => e.kind === "appt" || e.kind === "event";

/* ---------------------------- ARRASTAR E SOLTAR --------------------------- */

type Toast =
  | { kind: "moved"; id: number; label: string; clientLabel?: string | null; from: { day: string; startMin: number } }
  | { kind: "info" | "error"; message: string };

/**
 * Estado partilhado pelas vistas de mês e semana: posição optimista enquanto o servidor
 * confirma, aviso com "Avisar cliente" e "Desfazer".
 */
function useReschedule(events: CalEvent[]) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Map<string, { day: string; startMin: number }>>(new Map());
  const [seen, setSeen] = useState(events);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pending, start] = useTransition();

  // Eventos acabados de criar, editar ou apagar no formulário: aparecem já, antes da resposta do servidor
  const [local, setLocal] = useState<Map<string, CalEvent[] | null>>(new Map());
  useEffect(() => {
    const onSaved = (ev: Event) => {
      const { id, draft, deleted } = (ev as CustomEvent<{ id: number; draft?: AgendaEventDraft; deleted?: boolean }>).detail;
      setLocal((m) => new Map(m).set(`event:${id}`, deleted || !draft ? null : draftToEvents({ ...draft, id })));
    };
    window.addEventListener(AGENDA_SAVED, onSaved);
    return () => window.removeEventListener(AGENDA_SAVED, onSaved);
  }, []);

  // Chegaram dados novos do servidor: as posições optimistas já não são precisas
  if (seen !== events) {
    setSeen(events);
    setOverrides(new Map());
    setLocal(new Map());
  }

  const merged = [...events.filter((e) => !local.has(keyOf(e))), ...[...local.values()].flatMap((l) => l ?? [])];
  const shown = merged.map((e) => {
    const o = e.kind !== "busy" ? overrides.get(keyOf(e)) : undefined;
    if (!o) return e;
    const dur = e.endMin - e.startMin;
    return { ...e, day: o.day, startMin: o.startMin, endMin: Math.min(1440, o.startMin + dur), timeLabel: `${hhmm(o.startMin)}–${hhmm(Math.min(1439, o.startMin + dur))}` };
  });

  const move = (e: CalEvent, day: string, startMin: number, undo = false) => {
    const cur = shown.find((x) => keyOf(x) === keyOf(e)) ?? e;
    if (cur.day === day && cur.startMin === startMin) return;
    setOverrides((m) => new Map(m).set(keyOf(e), { day, startMin }));
    if (e.kind === "event") {
      start(async () => {
        const r = await moveAgendaEvent(e.id, day, startMin);
        if (!r.ok) {
          setOverrides((m) => {
            const n = new Map(m);
            n.delete(keyOf(e));
            return n;
          });
          setToast({ kind: "error", message: r.error ?? "Não foi possível mover o evento." });
          return;
        }
        setToast({ kind: "info", message: `“${e.title}” movido para ${hhmm(startMin)}.` });
        router.refresh();
      });
      return;
    }
    start(async () => {
      const r = await rescheduleAppointment(e.id, day, startMin);
      if (!r.ok) {
        setOverrides((m) => {
          const n = new Map(m);
          n.delete(keyOf(e));
          return n;
        });
        setToast({ kind: "error", message: r.error ?? "Não foi possível mover a sessão." });
        return;
      }
      setToast(
        undo || !r.from
          ? { kind: "info", message: "Alteração desfeita." }
          : { kind: "moved", id: e.id, label: r.label ?? "", clientLabel: r.clientLabel, from: r.from }
      );
      router.refresh();
    });
  };

  return { shown, move, toast, setToast, pending };
}

function RescheduleToast({
  toast,
  onClose,
  onUndo,
  pending,
}: {
  toast: Toast | null;
  onClose: () => void;
  onUndo: (id: number, from: { day: string; startMin: number }) => void;
  pending: boolean;
}) {
  const [notifying, start] = useTransition();
  const [notified, setNotified] = useState<string | null>(null);
  const [lastToast, setLastToast] = useState(toast);
  if (toast !== lastToast) {
    setLastToast(toast);
    setNotified(null);
  }
  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        className={cn(
          "flex animate-fade-in flex-wrap items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm shadow-[0_18px_40px_-12px_rgba(24,24,27,0.35)]",
          toast.kind === "error" ? "border-rose-200" : "border-zinc-200"
        )}
      >
        {pending && <Loader2 size={15} className="animate-spin text-plum" />}
        {toast.kind === "moved" ? (
          <>
            <span className="text-zinc-800">
              Sessão movida para <b>{toast.label}</b>
              {toast.clientLabel && <span className="text-zinc-500"> · {toast.clientLabel}</span>}
            </span>
            {notified ? (
              <span className="text-xs font-semibold text-emerald-700">{notified}</span>
            ) : (
              <button
                type="button"
                disabled={notifying}
                onClick={() => start(async () => setNotified((await notifyReschedule(toast.id)).message))}
                className="inline-flex items-center gap-1.5 rounded-full bg-plum px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-plum-ink disabled:opacity-60"
              >
                {notifying ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Avisar cliente
              </button>
            )}
            <button
              type="button"
              onClick={() => onUndo(toast.id, toast.from)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
            >
              <Undo2 size={13} /> Desfazer
            </button>
          </>
        ) : (
          <span className={toast.kind === "error" ? "text-rose-700" : "text-zinc-800"}>{toast.message}</span>
        )}
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100" aria-label="Fechar">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- MÊS ---------------------------------- */

export function MonthCalendar({ month, today, events }: { month: string; today: string; events: CalEvent[] }) {
  const [open, setOpenRaw] = useState<CalEvent | null>(null);
  const [draft, setDraft] = useState<AgendaEventDraft | null>(null);
  const setOpen = (e: CalEvent | null) => (e?.kind === "event" && e.draft ? setDraft(e.draft) : setOpenRaw(e));
  const { shown, move, toast, setToast, pending } = useReschedule(events);
  const dragging = useRef<CalEvent | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const weeks = Math.ceil((offset + new Date(y, m, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(y, m - 1, 1 - offset + i));

  return (
    <>
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-zinc-50 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = d.getMonth() === m - 1;
            const list = eventsOn(shown, d);
            const iso = isoDay(d);
            return (
              <div
                key={iso}
                onDragOver={(ev) => {
                  if (!dragging.current) return;
                  ev.preventDefault();
                  setOver(iso);
                }}
                onDragLeave={() => setOver((o) => (o === iso ? null : o))}
                onClick={(ev) => {
                  if (ev.target === ev.currentTarget) setDraft({ date: iso, start: "10:00", end: "11:00" });
                }}
                title="Clique num espaço vazio para criar um evento"
                onDrop={(ev) => {
                  ev.preventDefault();
                  setOver(null);
                  const e = dragging.current;
                  dragging.current = null;
                  if (e) move(e, iso, e.startMin);
                }}
                className={cn(
                  "min-h-[112px] cursor-pointer p-1.5 transition-colors",
                  over === iso
                    ? "bg-plum/[0.07] ring-2 ring-inset ring-plum/40"
                    : iso < today
                      ? "bg-zinc-100/80 hover:bg-zinc-100"
                      : inMonth
                        ? "bg-white hover:bg-plum/[0.025]"
                        : "bg-zinc-50 hover:bg-plum/[0.025]"
                )}
              >
                <Link
                  href={`/admin/agenda?view=calendario&modo=semana&d=${iso}`}
                  scroll={false}
                  className={cn(
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors hover:bg-plum/10",
                    iso === today ? "bg-plum text-white hover:bg-plum" : iso < today ? "text-zinc-400" : inMonth ? "text-zinc-700" : "text-zinc-400"
                  )}
                  title="Ver semana"
                >
                  {d.getDate()}
                </Link>
                <div className="space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <EventChip
                      key={`${e.kind}-${e.id}`}
                      e={e}
                      onOpen={setOpen}
                      onDragStart={() => (dragging.current = e)}
                      onDragEnd={() => {
                        dragging.current = null;
                        setOver(null);
                      }}
                    />
                  ))}
                  {list.length > 3 && (
                    <Link
                      href={`/admin/agenda?view=calendario&modo=semana&d=${iso}`}
                      scroll={false}
                      className="block px-1 text-[10px] font-semibold text-plum hover:underline"
                    >
                      +{list.length - 3} mais
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <EventModal event={open} onClose={() => setOpenRaw(null)} />
      <AgendaEventModal draft={draft} onClose={() => setDraft(null)} />
      <RescheduleToast
        toast={toast}
        pending={pending}
        onClose={() => setToast(null)}
        onUndo={(id, from) => {
          const e = shown.find((x) => x.kind === "appt" && x.id === id);
          if (e) move(e, from.day, from.startMin, true);
        }}
      />
    </>
  );
}

function EventChip({
  e,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  e: CalEvent;
  onOpen: (e: CalEvent) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const cancelled = e.status === "cancelled";
  return (
    <button
      type="button"
      draggable={canDrag(e)}
      onDragStart={(ev) => {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", String(e.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(e)}
      className={cn(
        "flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-[10px] font-medium transition-all hover:brightness-95",
        canDrag(e) && "cursor-grab active:cursor-grabbing",
        e.kind === "busy" ? "border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500" : "text-zinc-800",
        cancelled && "line-through opacity-50"
      )}
      style={tinted(e) ? { backgroundColor: `${e.color}1f` } : undefined}
      title={`${e.timeLabel} ${e.title}${e.clientLabel ? ` · ${e.clientLabel}` : ""}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
      <span className="shrink-0 tabular-nums text-zinc-500">{e.kind !== "appt" && e.startMin === 0 && e.endMin === 1440 ? "Dia" : hhmm(e.startMin)}</span>
      <span className="truncate">{e.title}</span>
      {e.clientShort && <span className="ml-auto shrink-0 text-[9px] text-sky-700">{e.clientShort}</span>}
    </button>
  );
}

/* -------------------------------- SEMANA -------------------------------- */

/** Distribui eventos sobrepostos em colunas lado a lado. */
function lanes(list: CalEvent[]) {
  const placed: { e: CalEvent; lane: number; lanes: number }[] = [];
  let group: { e: CalEvent; lane: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) placed.push({ ...g, lanes: n });
    group = [];
  };
  for (const e of list) {
    const s = e.startMin;
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.e.endMin > s).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ e, lane });
    groupEnd = Math.max(groupEnd, e.endMin);
  }
  if (group.length) flush();
  return placed;
}

export function WeekCalendar({
  weekStart,
  today,
  nowMin,
  events,
  availability,
}: {
  weekStart: string; // AAAA-MM-DD (segunda)
  today: string;
  nowMin: number;
  events: CalEvent[];
  availability: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    breakStart?: string | null;
    breakEnd?: string | null;
    active: boolean;
  }[];
}) {
  const [open, setOpenRaw] = useState<CalEvent | null>(null);
  const [draft, setDraft] = useState<AgendaEventDraft | null>(null);
  const setOpen = (e: CalEvent | null) => (e?.kind === "event" && e.draft ? setDraft(e.draft) : setOpenRaw(e));
  const { shown, move, toast, setToast, pending } = useReschedule(events);
  // Evento a ser arrastado e o ponto onde foi agarrado (minutos desde o início do evento)
  const dragging = useRef<{ e: CalEvent; grabMin: number } | null>(null);
  const [preview, setPreview] = useState<{ day: string; startMin: number; dur: number; id: number } | null>(null);
  const [y, m, d] = weekStart.split("-").map(Number);
  const days = Array.from({ length: 7 }, (_, i) => new Date(y, m - 1, d + i));
  const toMin = (t: string) => {
    const [h, mi] = t.split(":").map(Number);
    return h * 60 + mi;
  };

  // Intervalo de horas: disponibilidade e eventos da semana, com margem
  const mins = [
    ...availability.filter((a) => a.active).flatMap((a) => [toMin(a.startTime), toMin(a.endTime)]),
    ...shown.filter((e) => tinted(e) && !(e.startMin === 0 && e.endMin === 1440)).flatMap((e) => [e.startMin, e.endMin]),
  ];
  const startHour = Math.max(0, Math.floor((mins.length ? Math.min(...mins) : 540) / 60) - 1);
  const endHour = Math.min(24, Math.ceil((mins.length ? Math.max(...mins) : 1080) / 60) + 1);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-zinc-200 bg-zinc-50">
            <div />
            {days.map((day, i) => (
              <div key={i} className="border-l border-zinc-200 px-2 py-2.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{WEEKDAYS[i]}</p>
                <p
                  className={cn(
                    "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                    isoDay(day) === today ? "bg-plum text-white" : isoDay(day) < today ? "text-zinc-400" : "text-zinc-800"
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] bg-white">
            <div className="relative">
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[10px] tabular-nums text-zinc-400">
                  <span className="relative -top-1.5">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {days.map((day, i) => {
              const av = availability.find((a) => a.dayOfWeek === day.getDay() && a.active);
              const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX;
              const list = eventsOn(shown, day);
              const iso = isoDay(day);
              // Posição do rato → minuto do dia, com encaixe de 15 em 15 minutos
              const minuteAt = (ev: React.DragEvent<HTMLDivElement>) => {
                const drag = dragging.current!;
                const dur = drag.e.endMin - drag.e.startMin;
                const rect = ev.currentTarget.getBoundingClientRect();
                const raw = startHour * 60 + ((ev.clientY - rect.top) / HOUR_PX) * 60 - drag.grabMin;
                return Math.max(0, Math.min(1440 - dur, Math.round(raw / 15) * 15));
              };
              return (
                <div
                  key={i}
                  className="relative border-l border-zinc-200"
                  style={{ height: hours.length * HOUR_PX }}
                  onDragOver={(ev) => {
                    if (!dragging.current) return;
                    ev.preventDefault();
                    const startMin = minuteAt(ev);
                    const dur = dragging.current.e.endMin - dragging.current.e.startMin;
                    const id = dragging.current.e.id;
                    setPreview((p) => (p && p.day === iso && p.startMin === startMin ? p : { day: iso, startMin, dur, id }));
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    const drag = dragging.current;
                    if (!drag) return;
                    const startMin = minuteAt(ev);
                    dragging.current = null;
                    setPreview(null);
                    move(drag.e, iso, startMin);
                  }}
                  onClick={(ev) => {
                    // Clique num espaço vazio: novo evento a essa hora (de 30 em 30 minutos)
                    if ((ev.target as HTMLElement).closest("button")) return;
                    const rect = ev.currentTarget.getBoundingClientRect();
                    const min = Math.max(0, Math.min(1410, Math.floor((startHour * 60 + ((ev.clientY - rect.top) / HOUR_PX) * 60) / 30) * 30));
                    setDraft({ date: iso, start: hhmm(min), end: hhmm(Math.min(1439, min + 60)) });
                  }}
                  title="Clique num espaço vazio para criar um evento"
                >
                  {/* Fora do horário de trabalho fica sombreado */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#fafafa_0,#fafafa_6px,#f4f4f5_6px,#f4f4f5_12px)]" />
                  {av && (
                    <div
                      className="absolute inset-x-0 bg-white"
                      style={{ top: top(toMin(av.startTime)), height: top(toMin(av.endTime)) - top(toMin(av.startTime)) }}
                    />
                  )}
                  {av?.breakStart && av.breakEnd && (
                    <div
                      className="absolute inset-x-0 flex items-start justify-center bg-[repeating-linear-gradient(135deg,#fafafa_0,#fafafa_6px,#f4f4f5_6px,#f4f4f5_12px)] pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400"
                      style={{ top: top(toMin(av.breakStart)), height: top(toMin(av.breakEnd)) - top(toMin(av.breakStart)) }}
                    >
                      Intervalo
                    </div>
                  )}
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-zinc-100" style={{ top: (h - startHour) * HOUR_PX }} />
                  ))}
                  {/* Tempo que já passou fica a cinzento */}
                  {(iso < today || (iso === today && nowMin > startHour * 60)) && (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 bg-zinc-500/[0.09]"
                      style={{ height: iso < today ? "100%" : Math.min(top(nowMin), hours.length * HOUR_PX) }}
                    />
                  )}
                  {isoDay(day) === today && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
                    <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: top(nowMin) }}>
                      <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                      <span className="h-px flex-1 bg-rose-500" />
                    </div>
                  )}
                  {preview?.day === iso && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-plum bg-plum/10 px-1.5 py-1 text-[11px] font-semibold text-plum"
                      style={{ top: top(preview.startMin) + 1, height: Math.max(20, (preview.dur / 60) * HOUR_PX - 2) }}
                    >
                      {hhmm(preview.startMin)}–{hhmm(Math.min(1439, preview.startMin + preview.dur))}
                    </div>
                  )}
                  {lanes(list).map(({ e, lane, lanes: n }) => {
                    const sMin = Math.max(startHour * 60, e.startMin);
                    const eMin = Math.min(endHour * 60, e.endMin);
                    if (eMin <= sMin) return null;
                    const cancelled = e.status === "cancelled";
                    return (
                      <button
                        key={`${e.kind}-${e.id}`}
                        type="button"
                        title={`${e.title} · ${e.timeLabel} Lisboa${e.clientLabel ? ` · ${e.clientLabel}` : ""}`}
                        draggable={canDrag(e)}
                        onDragStart={(ev) => {
                          const rect = ev.currentTarget.getBoundingClientRect();
                          dragging.current = { e, grabMin: Math.round(((ev.clientY - rect.top) / HOUR_PX) * 60) };
                          ev.dataTransfer.effectAllowed = "move";
                          ev.dataTransfer.setData("text/plain", String(e.id));
                        }}
                        onDragEnd={() => {
                          dragging.current = null;
                          setPreview(null);
                        }}
                        onClick={() => setOpen(e)}
                        className={cn(
                          "absolute z-10 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:z-30 hover:shadow-md",
                          canDrag(e) && "cursor-grab active:cursor-grabbing",
                          preview?.id === e.id && tinted(e) && "opacity-40",
                          e.kind === "busy" ? "border border-dashed border-zinc-300 bg-zinc-100/90 text-zinc-500" : "text-zinc-900",
                          cancelled && "opacity-50"
                        )}
                        style={{
                          top: top(sMin) + 1,
                          height: Math.max(20, top(eMin) - top(sMin) - 2),
                          left: `calc(${(lane / n) * 100}% + 2px)`,
                          width: `calc(${100 / n}% - 4px)`,
                          ...(tinted(e) ? { backgroundColor: `${e.color}26`, borderLeftColor: e.color } : {}),
                        }}
                      >
                        <span className={cn("block truncate font-semibold", cancelled && "line-through")}>{e.title}</span>
                        <span className="block truncate text-[10px] text-zinc-500">
                          {e.timeLabel}
                          {e.clientShort && <span className="font-semibold text-sky-700"> · {e.clientShort}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Move size={12} /> Arraste uma sessão ou evento para outro dia ou hora (encaixa de 15 em 15 minutos) · clique num espaço vazio para criar um evento.
      </p>
      <EventModal event={open} onClose={() => setOpenRaw(null)} />
      <AgendaEventModal draft={draft} onClose={() => setDraft(null)} />
      <RescheduleToast
        toast={toast}
        pending={pending}
        onClose={() => setToast(null)}
        onUndo={(id, from) => {
          const e = shown.find((x) => x.kind === "appt" && x.id === id);
          if (e) move(e, from.day, from.startMin, true);
        }}
      />
    </>
  );
}

/* -------------------------------- DETALHE ------------------------------- */

function EventModal({ event: e, onClose }: { event: CalEvent | null; onClose: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const current = status ?? e?.status ?? "confirmed";
  return (
    <Modal
      open={Boolean(e)}
      onClose={() => {
        setStatus(null);
        onClose();
      }}
      title={e?.title ?? ""}
    >
      {e && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 text-zinc-700">
            <CalendarDays size={15} className="text-plum" />
            {e.dateLabel}
            <span className="text-zinc-400">·</span>
            <Clock size={14} className="text-plum" />
            {e.timeLabel} <span className="text-zinc-400">Lisboa</span>
          </div>
          {e.clientLabel && (
            <p className="-mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
              Para a cliente: {e.clientLabel}
            </p>
          )}
          {e.kind === "busy" ? (
            <p className="text-zinc-600">Evento do Google Calendar — este horário não aparece como livre na página de marcação.</p>
          ) : (
            <>
              <p className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                <span className="font-semibold text-zinc-900">{e.subtitle}</span>
              </p>
              <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="flex items-center gap-2 text-zinc-700">
                  <Mail size={14} className="text-zinc-400" /> {e.email}
                </p>
                {e.phone && (
                  <p className="flex items-center gap-2 text-zinc-700">
                    <Phone size={14} className="text-zinc-400" /> {e.phone}
                  </p>
                )}
                {e.meetingUrl && (
                  <div className="flex items-center gap-2">
                    <Video size={14} className="shrink-0 text-zinc-400" />
                    <a href={e.meetingUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-plum hover:underline">
                      {e.meetingUrl}
                    </a>
                    <CopyButton text={e.meetingUrl} label="Copiar" />
                  </div>
                )}
              </div>
              {e.notes && <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-zinc-600">{e.notes}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                  Estado
                  <SelectAction
                    value={current}
                    options={STATUS_OPTIONS}
                    onSelect={async (v) => {
                      setStatus(v);
                      await setAppointmentStatus(e.id, v);
                    }}
                  />
                </label>
                {e.contactId && (
                  <Link href={`/admin/crm/${e.contactId}`} className="btn-ghost !px-4 !py-2 !text-xs">
                    <UserRound size={14} /> Ficha do contacto
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

/* --------------------------- GOOGLE CALENDAR --------------------------- */

function ago(ms: number) {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h`;
}

/**
 * Estado da ligação ao Google Calendar com o botão "Sincronizar agora".
 * Com a página aberta, volta a pedir os dados ao servidor ao ritmo escolhido nas Configurações.
 */
export function CalendarSync({ configured, minutes, at, error, serverNow }: { configured: boolean; minutes: number; at: number; error: string | null; serverNow: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now, setNow] = useState(serverNow);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const auto = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, minutes * 60_000);
    return () => {
      clearInterval(tick);
      clearInterval(auto);
    };
  }, [minutes, router]);

  if (!configured)
    return (
      <Link href="/admin/config?s=calendar" className="btn-ghost !px-4 !py-2 !text-xs">
        <RefreshCw size={13} /> Ligar Google Calendar
      </Link>
    );

  const sync = () =>
    start(async () => {
      const r = await syncGoogleCalendar();
      setNow(Date.now());
      setMsg(r.ok ? { ok: true, text: `${r.count} evento${r.count === 1 ? "" : "s"} lido${r.count === 1 ? "" : "s"}` } : { ok: false, text: r.error ?? "Falha a sincronizar" });
      router.refresh();
      setTimeout(() => setMsg(null), 5000);
    });

  const failing = Boolean(error) && !msg;
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("hidden items-center gap-1.5 text-[11px] sm:flex", failing ? "text-rose-600" : "text-zinc-500")}
        title={failing ? (error ?? "") : `Sincroniza automaticamente a cada ${minutes} min`}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", failing ? "bg-rose-500" : "bg-emerald-500")} />
        {msg ? <span className={cn("pop font-semibold", msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</span> : failing ? "Falha na leitura" : `Google · ${at ? ago(now - at) : "por ler"}`}
      </span>
      <button type="button" onClick={sync} disabled={pending} className="btn-ghost !px-4 !py-2 !text-xs disabled:opacity-60">
        <RefreshCw size={13} className={cn(pending && "animate-spin")} /> {pending ? "A sincronizar…" : "Sincronizar agora"}
      </button>
    </div>
  );
}

/* --------------------------- EVENTOS INTERNOS --------------------------- */

export type AgendaEventDraft = {
  id?: number;
  title?: string;
  date: string; // AAAA-MM-DD
  endDate?: string;
  start?: string; // HH:MM
  end?: string;
  allDay?: boolean;
  blocks?: boolean;
  notes?: string | null;
  location?: string | null;
  color?: string;
};

const AGENDA_SAVED = "agenda:event-saved";
const announce = (detail: { id: number; draft?: AgendaEventDraft; deleted?: boolean }) =>
  window.dispatchEvent(new CustomEvent(AGENDA_SAVED, { detail }));

/** Mesma forma que o servidor dá aos compromissos (um bloco por dia), para os mostrar logo após gravar. */
function draftToEvents(d: AgendaEventDraft & { id: number }): CalEvent[] {
  const [y, m, dd] = d.date.split("-").map(Number);
  const last = d.allDay ? (d.endDate ?? d.date) : d.date;
  const out: CalEvent[] = [];
  for (let cur = new Date(y, m - 1, dd); isoDay(cur) <= last && out.length < 62; cur.setDate(cur.getDate() + 1)) {
    out.push({
      id: d.id,
      kind: "event",
      title: d.title ?? "",
      subtitle: [d.blocks === false ? "Não bloqueia marcações" : "Bloqueia marcações", d.location].filter(Boolean).join(" · "),
      day: isoDay(cur),
      startMin: d.allDay ? 0 : toMinutes(d.start ?? "00:00"),
      endMin: d.allDay ? 1440 : toMinutes(d.end ?? "00:00"),
      timeLabel: d.allDay ? "Dia inteiro" : `${d.start}–${d.end}`,
      dateLabel: new Date(y, m - 1, dd).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }),
      color: d.color ?? "#0ea5e9",
      notes: d.notes,
      draft: d,
    });
  }
  return out;
}

const EVENT_COLORS = [
  { value: "#0ea5e9", label: "Azul" },
  { value: "#800080", label: "Ameixa" },
  { value: "#10b981", label: "Verde" },
  { value: "#f59e0b", label: "Âmbar" },
  { value: "#f43f5e", label: "Rosa" },
  { value: "#71717a", label: "Cinza" },
];

const addMin = (time: string, min: number) => {
  const [h, m] = time.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + min);
  return hhmm(t);
};

/** Formulário de compromisso (criar ou editar). Com "bloquear", o período deixa de estar livre na página de marcação. */
export function AgendaEventModal({ draft, onClose }: { draft: AgendaEventDraft | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(draft)}
      onClose={onClose}
      title={draft?.id ? "Editar evento" : "Novo evento"}
      description="Compromisso na sua agenda — pode bloquear o horário para marcações"
      icon={CalendarPlus}
      size="lg"
    >
      {draft && <AgendaEventForm key={JSON.stringify(draft)} draft={draft} onClose={onClose} />}
    </Modal>
  );
}

function AgendaEventForm({ draft, onClose }: { draft: AgendaEventDraft; onClose: () => void }) {
  const router = useRouter();
  const [allDay, setAllDay] = useState(Boolean(draft.allDay));
  const [date, setDate] = useState(draft.date);
  const [endDate, setEndDate] = useState(draft.endDate ?? draft.date);
  const [start, setStart] = useState(draft.start ?? "10:00");
  const [end, setEnd] = useState(draft.end ?? addMin(draft.start ?? "10:00", 60));
  const [deleting, startDelete] = useTransition();
  const [state, run, pending] = useActionState(async (prev: AgendaEventResult | null, fd: FormData) => {
    const r = await saveAgendaEvent(draft.id ?? null, prev, fd);
    if (r.ok && r.id) {
      const all = fd.get("allDay") === "1";
      announce({
        id: r.id,
        draft: {
          id: r.id,
          title: String(fd.get("title") ?? "").trim(),
          date: String(fd.get("date")),
          endDate: String(fd.get("endDate") || fd.get("date")),
          start: all ? undefined : String(fd.get("start")),
          end: all ? undefined : String(fd.get("end")),
          allDay: all,
          blocks: fd.get("blocksBooking") === "1",
          notes: String(fd.get("notes") ?? "") || null,
          location: String(fd.get("location") ?? "") || null,
          color: String(fd.get("color") ?? "") || undefined,
        },
      });
      if (!r.warning) onClose();
      router.refresh();
    }
    return r;
  }, null);

  if (state?.ok && state.warning) {
    return (
      <div className="pb-6">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">Evento guardado.</p>
            <p className="mt-1">{state.warning} Essas sessões mantêm-se; mude-as na agenda se for preciso.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary !px-5 !py-2.5 !text-xs">
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      <FormSection icon={PenLine} title="O quê">
        <Field label="Título" required>
          <input name="title" required data-autofocus defaultValue={draft.title} placeholder="Ex.: Reunião com fornecedor, consulta médica, viagem…" className="field !text-base" />
        </Field>
        <Field label="Cor">
          <PillGroup name="color" defaultValue={draft.color ?? EVENT_COLORS[0].value} options={EVENT_COLORS.map((c) => ({ value: c.value, label: c.label, color: c.value }))} size="sm" />
        </Field>
      </FormSection>

      <FormSection
        icon={Clock}
        title="Quando"
        aside={
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-600">
            <input type="checkbox" name="allDay" value="1" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="peer sr-only" />
            <span className="relative h-4 w-7 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-plum peer-checked:after:translate-x-3" />
            Dia inteiro
          </label>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={allDay ? "De" : "Dia"}>
            <IconInput icon={CalendarDays}>
              <input
                type="date"
                name="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="field"
              />
            </IconInput>
          </Field>
          {allDay ? (
            <Field label="Até" hint="Para vários dias seguidos (férias, viagem…)">
              <IconInput icon={CalendarDays}>
                <input type="date" name="endDate" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
              </IconInput>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <input
                  type="time"
                  name="start"
                  required
                  step={300}
                  value={start}
                  onChange={(e) => {
                    const dur = Math.max(15, toMinutes(end) - toMinutes(start));
                    setStart(e.target.value);
                    if (e.target.value) setEnd(addMin(e.target.value, dur));
                  }}
                  className="field tabular-nums"
                />
              </Field>
              <Field label="Fim">
                <input type="time" name="end" required step={300} value={end} onChange={(e) => setEnd(e.target.value)} className="field tabular-nums" />
              </Field>
            </div>
          )}
        </div>
        {!allDay && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold text-zinc-400">Duração</span>
            {[
              [30, "30 min"],
              [60, "1 h"],
              [90, "1 h 30"],
              [120, "2 h"],
              [240, "4 h"],
            ].map(([min, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setEnd(addMin(start, Number(min)))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  toMinutes(end) - toMinutes(start) === min ? "border-plum bg-plum text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-plum/40 hover:text-plum"
                )}
              >
                {label}
              </button>
            ))}
            <input type="hidden" name="endDate" value={date} />
          </div>
        )}
        <ToggleRow name="blocksBooking" label="Bloquear marcações neste horário" description="As clientes deixam de ver estas horas como livres na página de agendamento." defaultChecked={draft.blocks ?? true} />
      </FormSection>

      <FormSection icon={MapPin} title="Detalhes">
        <Field label="Local ou link">
          <IconInput icon={MapPin}>
            <input name="location" defaultValue={draft.location ?? ""} placeholder="Morada, sala ou link da videochamada" className="field" />
          </IconInput>
        </Field>
        <Field label="Notas">
          <textarea name="notes" rows={3} defaultValue={draft.notes ?? ""} className="field resize-y" />
        </Field>
      </FormSection>

      <ModalFooter error={state?.error}>
        {draft.id && (
          <button
            type="button"
            disabled={deleting}
            onClick={() =>
              confirm("Apagar este evento? O horário volta a ficar livre para marcações.") &&
              startDelete(async () => {
                await deleteAgendaEvent(draft.id!);
                announce({ id: draft.id!, deleted: true });
                onClose();
                router.refresh();
              })
            }
            className="btn-ghost mr-auto !px-4 !py-2.5 !text-xs hover:!border-rose-200 hover:!text-rose-600"
          >
            <Trash2 size={13} /> Apagar
          </button>
        )}
        <button type="button" onClick={onClose} className="btn-ghost !px-5 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {draft.id ? "Guardar" : "Criar evento"}
        </button>
      </ModalFooter>
    </form>
  );
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Botão "Novo evento" da Agenda (abre sozinho com ?evento=novo, vindo do botão + do topo). */
export function NewAgendaEventButton({ today, initialOpen }: { today: string; initialOpen?: boolean }) {
  const [draft, setDraft] = useState<AgendaEventDraft | null>(initialOpen ? { date: today } : null);
  return (
    <>
      <button type="button" onClick={() => setDraft({ date: today })} className="btn-primary !px-4 !py-2 !text-xs">
        <CalendarPlus size={13} /> Novo evento
      </button>
      <AgendaEventModal
        draft={draft}
        onClose={() => {
          setDraft(null);
          // Tira ?evento=novo do endereço sem navegar (uma navegação podia trazer a página antes de gravar)
          if (initialOpen) window.history.replaceState(null, "", "/admin/agenda?view=calendario&modo=semana");
        }}
      />
    </>
  );
}
