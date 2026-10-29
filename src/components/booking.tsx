"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Video,
} from "lucide-react";
import { createBooking, getAvailableSlots, type Slot } from "@/lib/actions";
import { cityOf, FEATURED_ZONES, HOME_TZ, hoursFromHome, isValidTz, offsetLabel } from "@/lib/timezones";
import { cn } from "@/lib/utils";

type TypeOpt = { id: number; name: string; description: string | null; durationMin: number };

type DayOpt = { iso: string; dow: string; day: string; month: string };

// Fuso do browser; no servidor (e na hidratação) usa-se Lisboa
const noop = () => () => {};
const browserTz = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTz(tz) ? tz : HOME_TZ;
};

let allZones: string[] | null = null;
function zoneList() {
  try {
    allZones ??= (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    allZones = FEATURED_ZONES;
  }
  return allZones;
}

const zoneOption = (tz: string) => `${cityOf(tz)} — ${offsetLabel(tz)}`;

export function BookingFlow({
  types,
  windowDays = 21,
  initialTypeId,
  initialDate,
}: {
  types: TypeOpt[];
  windowDays?: number;
  /** Pré-selecção vinda de um link (ex: atalho "segunda, 2 nov" na página de links) */
  initialTypeId?: number;
  initialDate?: string;
}) {
  const detectedTz = useSyncExternalStore(noop, browserTz, () => HOME_TZ);
  // A lista completa de fusos difere entre Node e browser: só depois de hidratar
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [chosenTz, setChosenTz] = useState<string | null>(null);
  const tz = chosenTz ?? detectedTz;
  const [typeId, setTypeId] = useState(
    initialTypeId && types.some((t) => t.id === initialTypeId) ? initialTypeId : (types[0]?.id ?? 0)
  );
  const [date, setDate] = useState<string | null>(initialDate ?? null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(Boolean(initialDate));
  const [time, setTime] = useState<Slot | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const days: DayOpt[] = useMemo(() => {
    const out: DayOpt[] = [];
    const today = new Date();
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      out.push({
        iso,
        dow: d.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", ""),
        day: String(d.getDate()).padStart(2, "0"),
        month: d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", ""),
      });
    }
    return out;
  }, [windowDays]);

  const selected = types.find((t) => t.id === typeId);

  async function pickDate(iso: string, zone = tz) {
    setDate(iso);
    setTime(null);
    setLoadingSlots(true);
    try {
      const s = await getAvailableSlots(typeId, iso, zone);
      setSlots(s);
    } finally {
      setLoadingSlots(false);
    }
  }

  function pickTz(zone: string) {
    setChosenTz(zone);
    if (date) void pickDate(date, zone);
  }

  // Dia pré-seleccionado: carrega os horários assim que o fuso do browser é conhecido
  useEffect(() => {
    if (!initialDate || !mounted) return;
    let alive = true;
    void getAvailableSlots(typeId, initialDate, tz).then((s) => {
      if (!alive) return;
      setSlots(s);
      setLoadingSlots(false);
    });
    return () => {
      alive = false;
    };
    // Só na primeira vez; depois as escolhas da cliente mandam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const diff = hoursFromHome(tz);
  const diffLabel =
    diff === 0
      ? "a mesma hora de Lisboa"
      : `${Math.abs(diff)} h ${diff < 0 ? "atrás" : "à frente"} de Lisboa`;

  function pickType(id: number) {
    setTypeId(id);
    setDate(null);
    setSlots([]);
    setTime(null);
    setStep(1);
  }

  // Meio-dia UTC + timeZone UTC: o dia escolhido nunca muda com o fuso do browser
  const dateLabel = date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-PT", {
        timeZone: "UTC",
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  const timeLabel = time
    ? tz === HOME_TZ || time.time === time.lisbon
      ? `${time.time}${tz === HOME_TZ ? "" : ` (${cityOf(tz)})`}`
      : `${time.time} (${cityOf(tz)}) · ${time.lisbon} em Lisboa`
    : "";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date || !time) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createBooking({
        eventTypeId: typeId,
        date,
        slot: time.iso,
        timezone: tz,
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        notes: String(fd.get("notes") ?? ""),
      });
      if (res.ok) {
        setStep(3);
      } else {
        setError(res.error ?? "Não foi possível concluir o agendamento.");
      }
    });
  }

  if (step === 3) {
    return (
      <div className="animate-fade-in rounded-3xl border border-plum/40 bg-plum/[0.04] p-10 text-center lg:p-14">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-plum text-white">
          <Check size={30} />
        </span>
        <h2 className="mt-7 font-display text-4xl italic">Agendamento confirmado.</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-950">{selected?.name}</span> marcada para{" "}
          <span className="font-semibold text-plum">
            {dateLabel}, {timeLabel}
          </span>
          . Enviámos a confirmação para o seu email (e WhatsApp, se indicou o número),
          com o link da sessão e o convite para o calendário.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-500">
          <Video size={16} className="shrink-0 text-plum" />
          Sala Zoom criada automaticamente
        </div>
        <Link href="/" className="btn-ghost mt-8">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {step === 2 ? (
          <form onSubmit={submit} className="animate-fade-in space-y-5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-plum"
            >
              <ArrowLeft size={15} /> Escolher outro horário
            </button>
            {error && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Nome *
                </label>
                <input name="name" required className="field" placeholder="O seu nome" />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Email *
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="field"
                  placeholder="voce@email.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Telefone / WhatsApp
              </label>
              <input name="phone" className="field" placeholder="Com indicativo: +55 11 …, +351 9…" />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                O que gostaria de abordar?
              </label>
              <textarea
                name="notes"
                rows={4}
                className="field resize-none"
                placeholder="Partilhe o contexto: o seu momento, objetivos, dúvidas..."
              />
            </div>
            <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
              {pending ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
              {pending ? "A confirmar..." : "Confirmar agendamento"}
            </button>
          </form>
        ) : (
          <div className="animate-fade-in">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">
              1 · Tipo de sessão
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickType(t.id)}
                  className={cn(
                    "rounded-2xl border p-5 text-left transition-all",
                    typeId === t.id
                      ? "border-plum-bright bg-plum/[0.06]"
                      : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                  )}
                >
                  <p className="font-semibold text-zinc-950">{t.name}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock size={12} /> {t.durationMin} min
                  </p>
                </button>
              ))}
            </div>

            <p className="mt-9 text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">
              2 · Escolha o dia
            </p>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <button
                  key={d.iso}
                  onClick={() => pickDate(d.iso)}
                  className={cn(
                    "flex w-[68px] shrink-0 flex-col items-center rounded-2xl border px-2 py-3 transition-all",
                    date === d.iso
                      ? "border-plum-bright bg-plum text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {d.dow}
                  </span>
                  <span className="mt-1 font-display text-2xl font-semibold">{d.day}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70">{d.month}</span>
                </button>
              ))}
            </div>

            <div className="mt-9 flex flex-wrap items-end justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">3 · Escolha a hora</p>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <Globe size={14} className="text-plum" />
                <span className="sr-only">Fuso horário</span>
                <select
                  value={tz}
                  onChange={(e) => pickTz(e.target.value)}
                  className="field !w-auto max-w-[240px] !py-1.5 !text-xs"
                >
                  <optgroup label="Sugeridos">
                    {[...new Set([detectedTz, ...FEATURED_ZONES])].map((z) => (
                      <option key={z} value={z}>
                        {zoneOption(z)}
                        {z === detectedTz ? " · o seu" : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Todos os fusos">
                    {(mounted ? zoneList() : []).map((z) => (
                      <option key={`all-${z}`} value={z}>
                        {z.replace(/_/g, " ")}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Horários em <b className="font-semibold text-zinc-700">{cityOf(tz)}</b> ({offsetLabel(tz)})
              {tz !== HOME_TZ && <> — {diffLabel}, onde está a Marina.</>}
            </p>
            <div className="mt-4 min-h-[88px]">
              {!date ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                  Selecione primeiro um dia para ver os horários disponíveis.
                </p>
              ) : loadingSlots ? (
                <p className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-500">
                  <Loader2 size={15} className="animate-spin" /> A verificar disponibilidade...
                </p>
              ) : slots.length === 0 ? (
                <p className="rounded-2xl border border-zinc-200 p-6 text-center text-sm text-zinc-500">
                  Sem vagas neste dia. Experimente outra data.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {slots.map((s) => (
                    <button
                      key={s.iso}
                      onClick={() => setTime(s)}
                      className={cn(
                        "flex flex-col items-center rounded-xl border px-2 py-2 text-sm font-semibold transition-all",
                        time?.iso === s.iso
                          ? "border-plum-bright bg-plum text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                      )}
                    >
                      {s.time}
                      {tz !== HOME_TZ && s.time !== s.lisbon && (
                        <span className={cn("text-[10px] font-medium", time?.iso === s.iso ? "text-white/75" : "text-zinc-400")}>
                          {s.lisbon} Lisboa
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!date || !time}
              className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <aside className="h-fit rounded-3xl border border-zinc-200 bg-zinc-50 p-7 lg:sticky lg:top-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">
          Resumo
        </p>
        <h3 className="mt-3 font-display text-2xl italic">{selected?.name}</h3>
        <div className="mt-5 space-y-3 text-sm text-zinc-600">
          <p className="flex items-center gap-2.5">
            <Clock size={15} className="text-plum" /> {selected?.durationMin} minutos
          </p>
          <p className="flex items-center gap-2.5">
            <Video size={15} className="text-plum" /> Via Zoom (link automático)
          </p>
          <p className="flex items-center gap-2.5">
            <CalendarDays size={15} className="text-plum" />
            {date ? `${dateLabel}${time ? ` · ${timeLabel}` : ""}` : "Escolha data e hora"}
          </p>
        </div>
        {selected?.description && (
          <p className="mt-5 border-t border-zinc-200 pt-5 text-sm leading-relaxed text-zinc-500">
            {selected.description}
          </p>
        )}
        <div className="mt-5 border-t border-zinc-200 pt-5">
          <p className="text-xs leading-relaxed text-zinc-500">
            Ao confirmar, o evento entra no Google Calendar, recebe os dados por email e
            WhatsApp, e pode reagendar ou cancelar gratuitamente até 12h antes.
          </p>
        </div>
      </aside>
    </div>
  );
}
