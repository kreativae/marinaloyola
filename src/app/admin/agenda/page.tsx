import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, List, Plus, Video } from "lucide-react";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availability, eventTypes } from "@/db/schema";
import {
  createEventType,
  setAppointmentStatus,
  updateAvailability,
} from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel } from "@/components/admin-ui";
import { CopyButton, SelectAction } from "@/components/admin-client";
import { MonthCalendar, WeekCalendar, type CalEvent } from "@/components/agenda-calendar";
import { getBusy } from "@/lib/calendar";
import { cityOf, countryOfTz, flag, fmtTime, HOME_TZ } from "@/lib/timezones";
import { APPT_STATUS, cn, fmtDateTime, weekdayLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const APPT_OPTIONS = Object.entries(APPT_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; modo?: string; m?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ago = new Date(now.getTime() - 30 * 86400000);

  const [upcoming, past, types, avail] = await Promise.all([
    db
      .select({ appt: appointments, eventName: eventTypes.name, color: eventTypes.color })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(and(gte(appointments.startAt, startToday), eq(appointments.status, "confirmed")))
      .orderBy(asc(appointments.startAt))
      .limit(40),
    db
      .select({ appt: appointments, eventName: eventTypes.name })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(lt(appointments.startAt, startToday))
      .orderBy(desc(appointments.startAt))
      .limit(8),
    db.select().from(eventTypes).orderBy(eventTypes.id),
    db.select().from(availability).orderBy(asc(availability.dayOfWeek)),
  ]);

  return (
    <>
      <PageHeader
        title="Gestor de agenda"
        subtitle="Disponibilidade semanal, tipos de sessão e todos os agendamentos — com sala Zoom gerada automaticamente e sincronização com o Google Calendar."
        actions={
          <Link href="/agendar" target="_blank" className="btn-ghost !px-5 !py-2.5 !text-xs">
            Ver página pública
          </Link>
        }
      />

      <ViewTabs view={sp.view === "calendario" ? "calendario" : "lista"} />

      {sp.view === "calendario" && <CalendarSection sp={sp} avail={avail} />}

      <div className={cn("grid gap-6 xl:grid-cols-[1.6fr_1fr]", sp.view === "calendario" && "mt-6")}>
        <div className="min-w-0 space-y-6">
          <Panel title={`Próximas sessões (${upcoming.length})`}>
            {upcoming.length === 0 ? (
              <EmptyState text="Sem sessões futuras. Partilhe o link de agendamento." />
            ) : (
              <div className="table-shell">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="admin-th">Quando</th>
                      <th className="admin-th">Convidado</th>
                      <th className="admin-th hidden lg:table-cell">Sessão</th>
                      <th className="admin-th hidden md:table-cell">Zoom</th>
                      <th className="admin-th">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {upcoming.map(({ appt, eventName, color }) => (
                      <tr key={appt.id} className="transition-colors hover:bg-zinc-50">
                        <td className="admin-td whitespace-nowrap">
                          <span className="font-semibold text-zinc-950">{fmtDateTime(appt.startAt)}</span>
                          <span className="block text-[11px] text-zinc-500">
                            {new Date(appt.startAt).toLocaleTimeString("pt-PT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" — "}
                            {new Date(appt.endAt).toLocaleTimeString("pt-PT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {clientTime(appt.startAt, appt.endAt, appt.timezone) && (
                            <span className="mt-0.5 block text-[11px] font-semibold text-sky-700">
                              {clientTime(appt.startAt, appt.endAt, appt.timezone)}
                            </span>
                          )}
                        </td>
                        <td className="admin-td">
                          <p className="font-semibold text-zinc-950">{appt.name}</p>
                          <p className="text-xs text-zinc-500">{appt.email}</p>
                        </td>
                        <td className="admin-td hidden lg:table-cell">
                          <span
                            className="chip border-zinc-200"
                            style={{ backgroundColor: `${color ?? "#800080"}22`, color: "#3f3f46" }}
                          >
                            {eventName}
                          </span>
                        </td>
                        <td className="admin-td hidden md:table-cell">
                          {appt.meetingUrl && <CopyButton text={appt.meetingUrl} label="Link" />}
                        </td>
                        <td className="admin-td">
                          <SelectAction
                            value={appt.status}
                            options={APPT_OPTIONS}
                            onSelect={setAppointmentStatus.bind(null, appt.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Histórico recente (30 dias)">
            {past.length === 0 ? (
              <EmptyState text="Sem sessões passadas recentes." />
            ) : (
              <ul className="space-y-2.5">
                {past.map(({ appt, eventName }) => {
                  const st = APPT_STATUS[appt.status];
                  return (
                    <li
                      key={appt.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm text-zinc-500">
                        {appt.name} · {eventName}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-zinc-500">{fmtDateTime(appt.startAt)}</span>
                        <span className={`chip ${st?.className ?? ""}`}>{st?.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Tipos de sessão">
            <ul className="space-y-2.5">
              {types.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-8 w-1.5 shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-950">{t.name}</p>
                      <p className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock size={11} /> {t.durationMin} min · <Video size={11} /> Zoom
                      </p>
                    </div>
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full ${t.active ? "bg-emerald-400" : "bg-zinc-300"}`}
                    title={t.active ? "Ativo" : "Inativo"}
                  />
                </li>
              ))}
            </ul>
            <form action={createEventType} className="mt-5 space-y-2.5 border-t border-zinc-200 pt-5">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                <Plus size={12} /> Novo tipo de sessão
              </p>
              <input name="name" required placeholder="Nome (ex: Reunião exploratória)" className="field" />
              <div className="flex gap-2.5">
                <input
                  name="durationMin"
                  type="number"
                  min="5"
                  step="5"
                  defaultValue={30}
                  className="field w-28"
                />
                <input name="description" placeholder="Descrição breve" className="field flex-1" />
              </div>
              <button type="submit" className="btn-primary w-full !py-2.5 !text-xs">
                Adicionar tipo
              </button>
            </form>
          </Panel>

          <Panel title="Disponibilidade semanal">
            <div className="space-y-3">
              {avail.map((a) => (
                <form
                  key={a.id}
                  action={updateAvailability}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                >
                  <input type="hidden" name="id" value={a.id} />
                  <span className="w-10 shrink-0 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {weekdayLabel(a.dayOfWeek).slice(0, 3)}
                  </span>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={a.startTime}
                    className="field !w-[92px] !px-2 !py-1.5 !text-xs"
                  />
                  <span className="text-zinc-500">–</span>
                  <input
                    type="time"
                    name="endTime"
                    defaultValue={a.endTime}
                    className="field !w-[92px] !px-2 !py-1.5 !text-xs"
                  />
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={a.active}
                      className="h-4 w-4 rounded accent-[#800080]"
                    />
                    Ativo
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-plum/20 px-3 py-1.5 text-[11px] font-bold text-plum transition-colors hover:bg-plum/40"
                  >
                    Guardar
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
              <CalendarDays size={13} className="text-plum" />
              Intervalo de 15 min entre sessões · fuso Europe/Lisbon
            </p>
          </Panel>
        </div>
      </div>
    </>
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

function ViewTabs({ view }: { view: "lista" | "calendario" }) {
  const tab = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all",
      active ? "border-plum/40 bg-plum/10 text-plum" : "border-zinc-200 text-zinc-500 hover:text-zinc-700"
    );
  return (
    <div className="mb-6 flex gap-2">
      <Link href="/admin/agenda" scroll={false} className={tab(view === "lista")}>
        <List size={13} /> Lista
      </Link>
      <Link href="/admin/agenda?view=calendario" scroll={false} className={tab(view === "calendario")}>
        <CalendarDays size={13} /> Calendário
      </Link>
    </div>
  );
}

async function CalendarSection({
  sp,
  avail,
}: {
  sp: { modo?: string; m?: string; d?: string };
  avail: (typeof availability.$inferSelect)[];
}) {
  const now = new Date();
  const week = sp.modo === "semana";
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
  const navBtn = "rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 transition-colors hover:border-plum/50 hover:text-zinc-950";
  const modeBtn = (active: boolean) =>
    cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", active ? "bg-white text-plum shadow-sm" : "text-zinc-500 hover:text-zinc-800");

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link href={prevHref} scroll={false} className={navBtn} aria-label="Anterior">
            <ChevronLeft size={15} />
          </Link>
          <Link href={nextHref} scroll={false} className={navBtn} aria-label="Seguinte">
            <ChevronRight size={15} />
          </Link>
          <Link href={todayHref} scroll={false} className="ml-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-plum/50 hover:text-plum">
            Hoje
          </Link>
        </div>
        <h2 className="flex-1 font-display text-2xl text-zinc-950 first-letter:uppercase">{title}</h2>
        <span className="text-xs text-zinc-500">
          {counted.length} sessão(ões){busy.length ? " · ocupado do Google a cinzento" : ""}
        </span>
        <div className="flex rounded-lg bg-zinc-100 p-1">
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
