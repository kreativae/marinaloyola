import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  List,
  Plus,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Video,
} from "lucide-react";
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availability, eventTypes } from "@/db/schema";
import { createEventType, setAppointmentStatus, toggleEventType } from "@/lib/actions-admin";
import { CopyToWeekdays, DayHoursRow, type DayHours } from "@/components/availability-editor";
import { EmptyState, PageHeader, Panel } from "@/components/admin-ui";
import { CopyButton, SelectAction } from "@/components/admin-client";
import { MonthCalendar, WeekCalendar, type CalEvent } from "@/components/agenda-calendar";
import { getBusy } from "@/lib/calendar";
import { appUrl } from "@/lib/settings";
import { cityOf, countryOfTz, dayIn, flag, fmtTime, HOME_TZ } from "@/lib/timezones";
import { APPT_STATUS, cn, fmtDate, weekdayLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const APPT_OPTIONS = Object.entries(APPT_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

type Tab = "calendario" | "lista" | "disponibilidade";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; modo?: string; m?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.view === "lista" || sp.view === "disponibilidade" ? sp.view : "calendario";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(startToday.getTime() + 7 * 86_400_000);

  const [upcoming, avail, base] = await Promise.all([
    db
      .select({ appt: appointments, eventName: eventTypes.name, color: eventTypes.color })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(and(gte(appointments.startAt, startToday), ne(appointments.status, "cancelled")))
      .orderBy(asc(appointments.startAt))
      .limit(60),
    db.select().from(availability).orderBy(asc(availability.dayOfWeek)),
    appUrl(),
  ]);

  const todayKey = dayIn(now, HOME_TZ);
  const todayList = upcoming.filter((r) => dayIn(r.appt.startAt, HOME_TZ) === todayKey);
  const weekCount = upcoming.filter((r) => r.appt.startAt < weekEnd).length;
  const next = upcoming.find((r) => r.appt.startAt > now && r.appt.status === "confirmed");

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Sessões, disponibilidade e tipos de sessão num só lugar."
        actions={
          <>
            <CopyButton text={`${base}/agendar`} label="Copiar link de marcação" />
            <Link href="/agendar" target="_blank" className="btn-ghost !px-4 !py-2 !text-xs">
              Página pública <ExternalLink size={13} />
            </Link>
          </>
        }
      />

      {/* Resumo */}
      <div className="card stagger mb-6 grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Summary label="Hoje" value={todayList.length ? sessions(todayList.length) : "Livre"} hint={todayList.length ? todayList.map((r) => fmtTime(r.appt.startAt, HOME_TZ)).join(" · ") : "Sem sessões marcadas"} />
        <Summary label="Próximos 7 dias" value={sessions(weekCount)} hint={`${upcoming.length} no total agendadas`} />
        <div className="flex items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-400">Próxima sessão</p>
            {next ? (
              <>
                <p className="mt-1.5 truncate text-[15px] font-semibold text-zinc-950">{next.appt.name}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {dayLabel(next.appt.startAt, now)} · {fmtTime(next.appt.startAt, HOME_TZ)} · {untilLabel(next.appt.startAt, now)}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-zinc-500">Nenhuma sessão futura</p>
            )}
          </div>
          {next?.appt.meetingUrl && (
            <a
              href={next.appt.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plum text-white shadow-[0_8px_20px_-8px_rgb(128_0_128/0.7)] transition-transform hover:scale-105"
              title="Entrar na sessão"
            >
              <Video size={17} />
            </a>
          )}
        </div>
      </div>

      <Tabs tab={tab} />

      <div key={tab} className="animate-[rise_0.45s_var(--ease-out-soft)_backwards]">
        {tab === "calendario" && <CalendarSection sp={sp} avail={avail} />}
        {tab === "lista" && <ListView rows={upcoming} now={now} />}
        {tab === "disponibilidade" && <AvailabilityView avail={avail} />}
      </div>
    </>
  );
}

const sessions = (n: number) => `${n} ${n === 1 ? "sessão" : "sessões"}`;

function Summary({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-5">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-medium tracking-[-0.01em] text-zinc-950">{value}</p>
      <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function Tabs({ tab }: { tab: Tab }) {
  const items: { id: Tab; label: string; icon: typeof List; href: string }[] = [
    { id: "calendario", label: "Calendário", icon: CalendarRange, href: "/admin/agenda" },
    { id: "lista", label: "Lista", icon: List, href: "/admin/agenda?view=lista" },
    { id: "disponibilidade", label: "Disponibilidade", icon: SlidersHorizontal, href: "/admin/agenda?view=disponibilidade" },
  ];
  return (
    <div className="mb-5 inline-flex rounded-2xl border border-line bg-white p-1 shadow-[0_1px_2px_rgb(24_24_27/0.04)]">
      {items.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          scroll={false}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-300",
            tab === t.id ? "bg-plum text-white shadow-[0_6px_16px_-8px_rgb(128_0_128/0.8)]" : "text-zinc-500 hover:text-zinc-900"
          )}
        >
          <t.icon size={15} />
          <span className="hidden sm:inline">{t.label}</span>
        </Link>
      ))}
    </div>
  );
}

/* --------------------------------- LISTA -------------------------------- */

function dayLabel(d: Date, now: Date) {
  const key = dayIn(d, HOME_TZ);
  if (key === dayIn(now, HOME_TZ)) return "Hoje";
  if (key === dayIn(new Date(now.getTime() + 86_400_000), HOME_TZ)) return "Amanhã";
  // Montado à mão: o pt-PT junta dia e mês em "31/10" quando se pede o mês abreviado
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const month = d.toLocaleDateString("pt-PT", { month: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d.getDate()} de ${month}`;
}

function untilLabel(d: Date, now: Date) {
  const min = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (min < 60) return `daqui a ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `daqui a ${h} h`;
  return `daqui a ${Math.round(h / 24)} dias`;
}

type Row = { appt: typeof appointments.$inferSelect; eventName: string | null; color: string | null };

async function ListView({ rows, now }: { rows: Row[]; now: Date }) {
  const past = await db
    .select({ appt: appointments, eventName: eventTypes.name, color: eventTypes.color })
    .from(appointments)
    .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
    .where(and(lt(appointments.startAt, new Date(now.getFullYear(), now.getMonth(), now.getDate())), gte(appointments.startAt, new Date(now.getTime() - 30 * 86_400_000))))
    .orderBy(desc(appointments.startAt))
    .limit(20);

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = dayIn(r.appt.startAt, HOME_TZ);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <Panel>
          <EmptyState text="Sem sessões futuras. Partilhe o link de marcação." icon={<CalendarDays size={18} />} />
        </Panel>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([k, list]) => (
            <section key={k}>
              <h3 className="mb-2.5 flex items-baseline gap-2 px-1">
                <span className="text-sm font-semibold text-zinc-900">{dayLabel(list[0].appt.startAt, now)}</span>
                <span className="text-xs text-zinc-400">
                  {sessions(list.length)}
                </span>
              </h3>
              <ul className="card stagger divide-y divide-line overflow-hidden">
                {list.map((r) => (
                  <SessionRow key={r.appt.id} r={r} now={now} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <details className="group card">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-4 text-sm font-semibold text-zinc-700 hover:text-zinc-950">
          <History size={16} className="text-zinc-400" /> Histórico dos últimos 30 dias
          <span className="text-xs font-normal text-zinc-400">{past.length}</span>
          <ChevronRight size={15} className="ml-auto text-zinc-400 transition-transform group-open:rotate-90" />
        </summary>
        {past.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-zinc-500">Sem sessões nos últimos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {past.map((r) => (
              <SessionRow key={r.appt.id} r={r} now={now} past />
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function SessionRow({ r, now, past = false }: { r: Row; now: Date; past?: boolean }) {
  const { appt } = r;
  const other = clientTime(appt.startAt, appt.endAt, appt.timezone);
  const st = APPT_STATUS[appt.status];
  const live = !past && appt.startAt <= now && appt.endAt > now;
  return (
    <li className={cn("group flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 transition-colors hover:bg-zinc-50/70", past && "py-3")}>
      <div className="w-[88px] shrink-0">
        <p className={cn("font-display text-lg leading-none tabular-nums", past ? "text-zinc-500" : "text-zinc-950")}>
          {fmtTime(appt.startAt, HOME_TZ)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          {past ? fmtDate(appt.startAt) : `até ${fmtTime(appt.endAt, HOME_TZ)}`}
        </p>
      </div>
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: r.color ?? "#800080", opacity: past ? 0.4 : 1 }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-950">
          {appt.name}
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> A decorrer
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {r.eventName}
          {other && <span className="ml-2 font-semibold text-sky-700">{other}</span>}
        </p>
      </div>
      {past ? (
        <span className={cn("chip", st?.className)}>{st?.label}</span>
      ) : (
        <div className="flex items-center gap-1.5">
          {appt.meetingUrl && (
            <a
              href={appt.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-plum/[0.07] hover:text-plum"
              title="Abrir videochamada"
            >
              <Video size={16} />
            </a>
          )}
          {appt.contactId && (
            <Link
              href={`/admin/crm/${appt.contactId}`}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-plum/[0.07] hover:text-plum"
              title="Ficha do contacto"
            >
              <UserRound size={16} />
            </Link>
          )}
          <SelectAction value={appt.status} options={APPT_OPTIONS} onSelect={setAppointmentStatus.bind(null, appt.id)} />
        </div>
      )}
    </li>
  );
}

/* ---------------------------- DISPONIBILIDADE ---------------------------- */

async function AvailabilityView({ avail }: { avail: (typeof availability.$inferSelect)[] }) {
  const types = await db.select().from(eventTypes).orderBy(eventTypes.id);
  // Segunda a domingo
  const days: DayHours[] = [...avail]
    .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
    .map((a) => ({
      id: a.id,
      label: weekdayLabel(a.dayOfWeek),
      startTime: a.startTime,
      endTime: a.endTime,
      breakStart: a.breakStart,
      breakEnd: a.breakEnd,
      active: a.active,
    }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel
        title="Horário semanal"
        description="Horas em que a página pública aceita marcações, com intervalo opcional (hora de Lisboa)"
        action={
          <Link href="/admin/config?s=agendamento" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-plum">
            <Settings2 size={13} /> Regras
          </Link>
        }
      >
        <ul className="space-y-2">
          {days.map((d) => (
            <DayHoursRow key={d.id} day={d} />
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-zinc-500">As alterações ficam guardadas automaticamente.</p>
          <CopyToWeekdays days={days} />
        </div>
      </Panel>

      <Panel title="Tipos de sessão" description="O que as clientes podem marcar">
        <ul className="stagger space-y-2.5">
          {types.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-line px-4 py-3 transition-colors",
                !t.active && "bg-zinc-50/60"
              )}
            >
              <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: t.color, opacity: t.active ? 1 : 0.35 }} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className={cn("truncate text-sm font-semibold", t.active ? "text-zinc-950" : "text-zinc-400")}>{t.name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-500">
                    <Clock size={10} /> {t.durationMin} min
                  </span>
                </p>
                {t.description && <p className="mt-0.5 truncate text-xs text-zinc-400">{t.description}</p>}
              </div>
              <form action={toggleEventType.bind(null, t.id)}>
                <button
                  type="submit"
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                    t.active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  )}
                  title={t.active ? "Desactivar na página pública" : "Activar na página pública"}
                >
                  {t.active ? "Activo" : "Inactivo"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500 transition-colors hover:border-plum/30 hover:text-plum">
            <Plus size={15} /> Novo tipo de sessão
          </summary>
          <form action={createEventType} className="mt-3 space-y-2.5">
            <input name="name" required placeholder="Nome (ex: Reunião exploratória)" className="field" />
            <div className="flex gap-2.5">
              <div className="relative w-32 shrink-0">
                <input name="durationMin" type="number" min="5" step="5" defaultValue={30} className="field !pr-11" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">min</span>
              </div>
              <input name="description" placeholder="Descrição breve" className="field flex-1" />
            </div>
            <button type="submit" className="btn-primary w-full !py-2.5 !text-xs">
              Adicionar
            </button>
          </form>
        </details>
      </Panel>
    </div>
  );
}

/* ------------------------------ CALENDÁRIO ------------------------------ */

/** "🇧🇷 10:00–10:30 Brasília" quando a cliente está noutro fuso (com hora diferente). */
function clientTime(start: Date, end: Date, tz: string) {
  if (tz === HOME_TZ || fmtTime(start, tz) === fmtTime(start, HOME_TZ)) return null;
  return `${flag(countryOfTz(tz))} ${fmtTime(start, tz)}–${fmtTime(end, tz)} ${cityOf(tz)}`.trim();
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function CalendarSection({
  sp,
  avail,
}: {
  sp: { modo?: string; m?: string; d?: string };
  avail: (typeof availability.$inferSelect)[];
}) {
  const now = new Date();
  // A semana é a vista por omissão; o mês abre com ?m=AAAA-MM
  const week = sp.modo === "semana" || !sp.m;
  let from: Date;
  let to: Date;
  let title: string;
  let prevHref: string;
  let nextHref: string;
  let month = "";
  let weekStart = "";

  if (week) {
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? new Date(`${sp.d}T12:00:00`) : now;
    from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ((ref.getDay() + 6) % 7));
    to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    weekStart = iso(from);
    const last = new Date(to.getTime() - 86_400_000);
    const mon = (d: Date) => d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "");
    title = `${from.getDate()} ${mon(from)} – ${last.getDate()} ${mon(last)} ${last.getFullYear()}`;
    prevHref = `/admin/agenda?view=calendario&modo=semana&d=${iso(new Date(from.getFullYear(), from.getMonth(), from.getDate() - 7))}`;
    nextHref = `/admin/agenda?view=calendario&modo=semana&d=${iso(to)}`;
  } else {
    const [y, mo] = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m!.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const first = new Date(y, mo - 1, 1);
    month = `${y}-${String(mo).padStart(2, "0")}`;
    from = new Date(y, mo - 1, 1 - ((first.getDay() + 6) % 7));
    to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 42);
    title = first.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    prevHref = `/admin/agenda?view=calendario&m=${ym(new Date(y, mo - 2, 1))}`;
    nextHref = `/admin/agenda?view=calendario&m=${ym(new Date(y, mo, 1))}`;
  }

  const [rows, busy] = await Promise.all([
    db
      .select({ appt: appointments, eventName: eventTypes.name, color: eventTypes.color })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(and(gte(appointments.startAt, from), lt(appointments.startAt, to)))
      .orderBy(asc(appointments.startAt)),
    getBusy(),
  ]);

  // Divide cada evento por dia (hora de Lisboa, o fuso do servidor)
  const segments = (start: Date, end: Date) => {
    const out: { day: string; startMin: number; endMin: number }[] = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur < end && out.length < 60) {
      const next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      const s = start > cur ? start : cur;
      const e = end < next ? end : next;
      const toMin = (d: Date) => (d.getTime() === next.getTime() ? 1440 : d.getHours() * 60 + d.getMinutes());
      if (e > s) out.push({ day: iso(cur), startMin: toMin(s), endMin: toMin(e) });
      cur = next;
    }
    return out;
  };
  const hm = (d: Date) => d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = (d: Date) => d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });

  const events: CalEvent[] = [
    ...rows.flatMap(({ appt, eventName, color }) =>
      segments(appt.startAt, appt.endAt).map((seg) => ({
        id: appt.id,
        kind: "appt" as const,
        title: appt.name,
        subtitle: eventName ?? "Sessão",
        ...seg,
        timeLabel: `${hm(appt.startAt)}–${hm(appt.endAt)}`,
        clientLabel: clientTime(appt.startAt, appt.endAt, appt.timezone),
        clientShort: clientTime(appt.startAt, appt.endAt, appt.timezone)
          ? `${flag(countryOfTz(appt.timezone))} ${fmtTime(appt.startAt, appt.timezone)}`.trim()
          : null,
        dateLabel: dateLabel(appt.startAt),
        color: color ?? "#800080",
        status: appt.status,
        email: appt.email,
        phone: appt.phone,
        notes: appt.notes,
        meetingUrl: appt.meetingUrl,
        contactId: appt.contactId,
      }))
    ),
    ...busy
      .filter((b) => b.start < to && b.end > from)
      .flatMap((b, i) =>
        segments(b.start, b.end).map((seg) => ({
          id: i,
          kind: "busy" as const,
          title: "Ocupado",
          subtitle: "Google Calendar",
          ...seg,
          timeLabel: seg.startMin === 0 && seg.endMin === 1440 ? "Dia inteiro" : `${hm(b.start)}–${hm(b.end)}`,
          dateLabel: dateLabel(new Date(`${seg.day}T12:00:00`)),
          color: "#a1a1aa",
        }))
      ),
  ];
  const counted = rows.filter((r) => r.appt.status !== "cancelled");
  const todayHref = week ? `/admin/agenda?view=calendario&modo=semana&d=${iso(now)}` : "/admin/agenda?view=calendario";
  const navBtn = "rounded-xl border border-line bg-white p-2 text-zinc-500 transition-colors hover:border-plum/30 hover:text-plum";
  const modeBtn = (active: boolean) =>
    cn("rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all", active ? "bg-white text-plum shadow-sm" : "text-zinc-500 hover:text-zinc-800");

  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link href={prevHref} scroll={false} className={navBtn} aria-label="Anterior">
            <ChevronLeft size={15} />
          </Link>
          <Link href={nextHref} scroll={false} className={navBtn} aria-label="Seguinte">
            <ChevronRight size={15} />
          </Link>
          <Link href={todayHref} scroll={false} className="ml-1 rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-plum/30 hover:text-plum">
            Hoje
          </Link>
        </div>
        <h2 className="flex-1 font-display text-[1.6rem] tracking-[-0.01em] text-zinc-950 first-letter:uppercase">{title}</h2>
        <span className="text-xs text-zinc-500">
          {sessions(counted.length)}{busy.length ? " · ocupado do Google a cinzento" : ""}
        </span>
        <div className="flex rounded-xl bg-zinc-100 p-1">
          <Link href={`/admin/agenda?view=calendario&m=${(week ? weekStart : iso(now)).slice(0, 7)}`} scroll={false} className={modeBtn(!week)}>
            Mês
          </Link>
          <Link href={`/admin/agenda?view=calendario&modo=semana&d=${week ? weekStart : month === iso(now).slice(0, 7) ? iso(now) : `${month}-01`}`} scroll={false} className={modeBtn(week)}>
            Semana
          </Link>
        </div>
      </div>
      {week ? (
        <WeekCalendar weekStart={weekStart} today={iso(now)} nowMin={now.getHours() * 60 + now.getMinutes()} events={events} availability={avail} />
      ) : (
        <MonthCalendar month={month} today={iso(now)} events={events} />
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-zinc-500">
        {[...new Map(rows.map((r) => [r.eventName, r.color])).entries()].map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color ?? "#800080" }} /> {name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-300" /> Cancelado (riscado)
        </span>
      </div>
    </Panel>
  );
}
