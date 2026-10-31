import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Layers,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  NotebookPen,
  Pin,
  StickyNote,
  Trash2,
} from "lucide-react";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  contacts,
  contactTags,
  deals,
  eventTypes,
  interactions,
  noteContacts,
  notes,
  payments,
  pipelineStages,
  tags,
  whatsappMessages,
} from "@/db/schema";
import { addContactNote, deleteInteraction, setContactStatus, setPaymentStatus } from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { SelectAction } from "@/components/admin-client";
import { ChannelChip, ContactFormButton, DeleteContactButton } from "@/components/contacts-client";
import { listChannels } from "@/lib/channels";
import { LocalTime } from "@/components/local-time";
import { NewContactNoteButton } from "@/components/notes-client";
import { DeleteConversationButton } from "@/components/whatsapp-client";
import { notePreview, noteTasks, noteTitle } from "@/lib/notes-def";
import { countryName, flag } from "@/lib/timezones";
import { APPT_STATUS, CONTACT_STATUS, eur, fmtDate, fmtDateTime, initials, INTERACTION_ICONS, num, PAYMENT_METHODS, PAYMENT_STATUS, SOURCES } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = Object.entries(CONTACT_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));
const PAYMENT_OPTIONS = Object.entries(PAYMENT_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contactId = Number(id);
  if (!Number.isInteger(contactId)) notFound();

  const [[contact], tagRows, timeline, paymentRows, apptRows, dealRows] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1),
    db
      .select({ name: tags.name, color: tags.color })
      .from(contactTags)
      .innerJoin(tags, eq(tags.id, contactTags.tagId))
      .where(eq(contactTags.contactId, contactId)),
    db
      .select()
      .from(interactions)
      .where(eq(interactions.contactId, contactId))
      .orderBy(desc(interactions.createdAt))
      .limit(60),
    db
      .select()
      .from(payments)
      .where(eq(payments.contactId, contactId))
      .orderBy(desc(payments.createdAt)),
    db
      .select({ appt: appointments, eventName: eventTypes.name })
      .from(appointments)
      .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
      .where(eq(appointments.contactId, contactId))
      .orderBy(desc(appointments.startAt))
      .limit(10),
    db
      .select({ deal: deals, stageName: pipelineStages.name })
      .from(deals)
      .leftJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .where(eq(deals.contactId, contactId))
      .orderBy(desc(deals.createdAt)),
  ]);

  if (!contact) notFound();
  const [noteRows, [{ waCount }]] = await Promise.all([
    db
      .select({ id: notes.id, body: notes.body, pinned: notes.pinned, updatedAt: notes.updatedAt })
      .from(noteContacts)
      .innerJoin(notes, eq(notes.id, noteContacts.noteId))
      .where(and(eq(noteContacts.contactId, contactId), isNull(notes.deletedAt)))
      .orderBy(desc(notes.pinned), desc(notes.updatedAt)),
    db.select({ waCount: count() }).from(whatsappMessages).where(eq(whatsappMessages.contactId, contactId)),
  ]);
  const channelOptions = await listChannels();
  const channel = channelOptions.find((c) => c.id === contact.channelId);

  const totalSpent = paymentRows
    .filter((p) => p.status === "confirmed" || p.status === "completed")
    .reduce((a, p) => a + Number(p.amount), 0);
  const pendingTotal = paymentRows
    .filter((p) => p.status === "pending")
    .reduce((a, p) => a + Number(p.amount), 0);
  const status = CONTACT_STATUS[contact.status];
  const waPhone = contact.phone?.replace(/\D/g, "");

  return (
    <>
      <Link
        href="/admin/contactos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-plum"
      >
        <ArrowLeft size={15} /> Voltar aos contactos
      </Link>

      <PageHeader
        title={contact.name}
        subtitle={`${SOURCES[contact.source] ?? contact.source} · cliente desde ${fmtDate(contact.createdAt)}`}
        actions={
          <>
            {waPhone && (
              <Link
                href={`/admin/whatsapp?c=${contact.id}`}
                className="btn-ghost !px-5 !py-2.5 !text-xs"
              >
                <MessageCircle size={14} /> Conversa WhatsApp
              </Link>
            )}
            {waCount > 0 && <DeleteConversationButton contactId={contact.id} name={contact.name} count={waCount} />}
            <SelectAction
              value={contact.status}
              options={STATUS_OPTIONS}
              onSelect={setContactStatus.bind(null, contact.id)}
            />
            <ContactFormButton
              contact={contact}
              channels={channelOptions}
              trigger={
                <span className="btn-ghost !px-5 !py-2.5 !text-xs">
                  <Pencil size={14} /> Editar
                </span>
              }
            />
            <DeleteContactButton id={contact.id} name={contact.name} />
          </>
        }
      />

      {/* Cabeçalho da ficha */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plum text-xl font-bold text-white">
            {initials(contact.name)}
          </span>
          <div className="grid flex-1 gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <p className="flex items-center gap-2 text-sm text-zinc-600">
              <Mail size={14} className="shrink-0 text-plum" />
              <span className="truncate">{contact.email ?? "—"}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-zinc-600">
              <Phone size={14} className="shrink-0 text-plum" />
              {contact.phone ?? "—"}
            </p>
            <p className="flex items-center gap-2 text-sm text-zinc-600">
              <MapPin size={14} className="shrink-0 text-plum" />
              {[contact.location, contact.country ? `${flag(contact.country)} ${countryName(contact.country)}` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <span
                className={`chip ${status?.className ?? "border-zinc-200 bg-zinc-100 text-zinc-600"}`}
              >
                {status?.label}
              </span>
            </p>
          </div>
        </div>
        {contact.timezone && (
          <p className="mt-5 border-t border-zinc-200 pt-5 text-sm text-zinc-600">
            <LocalTime timezone={contact.timezone} country={contact.country} />
          </p>
        )}
        {(channel || contact.referredBy) && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5 text-sm text-zinc-600">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Canal de origem</span>
            {channel ? <ChannelChip channel={channel} /> : <span>—</span>}
            {contact.referredBy && (
              <span>
                · indicado por <b className="font-semibold text-zinc-800">{contact.referredBy}</b>
              </span>
            )}
          </div>
        )}
        {contact.notes && (
          <p className="mt-5 whitespace-pre-wrap border-t border-zinc-200 pt-5 text-sm leading-relaxed text-zinc-600">
            {contact.notes}
          </p>
        )}
        {tagRows.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-200 pt-5">
            {tagRows.map((t) => (
              <span
                key={t.name}
                className="chip"
                style={{
                  borderColor: `${t.color}66`,
                  backgroundColor: `${t.color}14`,
                  color: "#3f3f46",
                }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label="Total investido" value={eur(totalSpent)} icon={<Banknote size={18} />} accent />
        <StatCard label="Pendente" value={eur(pendingTotal)} icon={<Banknote size={18} />} />
        <StatCard
          label="Interações"
          value={num(timeline.length)}
          hint={`${apptRows.length} agendamento(s) · ${dealRows.length} negócio(s)`}
          icon={<StickyNote size={18} />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Timeline */}
        <Panel title="Histórico de interações">
          <form action={addContactNote.bind(null, contact.id)} className="mb-6 flex gap-3">
            <input
              name="content"
              required
              placeholder="Adicionar nota (ex: ligou a pedir proposta...)"
              className="field flex-1"
            />
            <button type="submit" className="btn-primary shrink-0 !px-4 !py-2.5 !text-xs">
              <Plus size={14} /> Nota
            </button>
          </form>
          {timeline.length === 0 ? (
            <EmptyState text="Sem interações registadas." />
          ) : (
            <ul className="relative space-y-0 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-zinc-200/70">
              {timeline.map((i) => (
                <li key={i.id} className="group relative flex gap-4 pb-5 pl-6 last:pb-0">
                  <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-plum bg-white" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-zinc-600">{i.content}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {INTERACTION_ICONS[i.type] ?? i.type} · {fmtDateTime(i.createdAt)}
                    </p>
                  </div>
                  <form action={deleteInteraction.bind(null, i.id)} className="shrink-0">
                    <button
                      type="submit"
                      title="Apagar do histórico"
                      aria-label="Apagar do histórico"
                      className="rounded-lg p-1.5 text-zinc-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          {/* Notas ligadas */}
          <Panel title="Notas" action={<NewContactNoteButton contactId={contact.id} />}>
            {noteRows.length === 0 ? (
              <EmptyState text="Sem notas ligadas a este contacto." />
            ) : (
              <ul className="space-y-2.5">
                {noteRows.map((n) => {
                  const t = noteTasks(n.body);
                  return (
                    <li key={n.id}>
                      <Link
                        href={`/admin/notas?n=${n.id}`}
                        className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50"
                      >
                        <NotebookPen size={15} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-950">
                            {n.pinned && <Pin size={12} className="shrink-0 text-amber-500" />}
                            {noteTitle(n.body) || "Nova nota"}
                          </p>
                          <p className="truncate text-xs text-zinc-500">{notePreview(n.body) || "Sem texto adicional"}</p>
                        </div>
                        <div className="shrink-0 text-right text-[11px] text-zinc-500">
                          <p>{fmtDate(n.updatedAt)}</p>
                          {t.open + t.done > 0 && (
                            <p className={t.open ? "text-amber-700" : "text-emerald-600"}>
                              {t.done}/{t.open + t.done} tarefas
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Compras */}
          <Panel title="Compras & pagamentos">
            {paymentRows.length === 0 ? (
              <EmptyState text="Nenhuma compra registada." />
            ) : (
              <ul className="space-y-3">
                {paymentRows.map((p) => {
                  const st = PAYMENT_STATUS[p.status];
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-950">{p.product}</p>
                        <p className="text-xs text-zinc-500">
                          {PAYMENT_METHODS[p.method]} · {fmtDate(p.createdAt)}
                          {p.reference ? ` · ref. ${p.reference}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold tabular-nums text-zinc-950">
                          {eur(p.amount)}
                        </span>
                        <span className={`chip ${st?.className ?? ""}`}>{st?.label}</span>
                        {p.status === "pending" && (
                          <SelectAction
                            value={p.status}
                            options={PAYMENT_OPTIONS}
                            onSelect={setPaymentStatus.bind(null, p.id)}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Negócios */}
          <Panel title="Negócios no pipeline">
            {dealRows.length === 0 ? (
              <EmptyState text="Sem negócios associados." />
            ) : (
              <ul className="space-y-3">
                {dealRows.map(({ deal, stageName }) => (
                  <li
                    key={deal.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Layers size={15} className="shrink-0 text-plum" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-950">{deal.title}</p>
                        <p className="text-xs text-zinc-500">
                          {deal.product} · {stageName}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-plum">
                      {eur(deal.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Agendamentos */}
          <Panel title="Agendamentos">
            {apptRows.length === 0 ? (
              <EmptyState text="Sem sessões agendadas." />
            ) : (
              <ul className="space-y-3">
                {apptRows.map(({ appt, eventName }) => {
                  const st = APPT_STATUS[appt.status];
                  return (
                    <li
                      key={appt.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <CalendarDays size={15} className="shrink-0 text-plum" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-950">{eventName}</p>
                          <p className="text-xs text-zinc-500">{fmtDateTime(appt.startAt)}</p>
                        </div>
                      </div>
                      <span className={`chip shrink-0 ${st?.className ?? ""}`}>{st?.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
