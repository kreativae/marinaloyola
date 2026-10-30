"use client";

import { startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  AtSign,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Compass,
  Contact2,
  CreditCard,
  Download,
  Eye,
  Flag,
  Globe,
  Handshake,
  HeartHandshake,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  PenLine,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  Upload,
  UserPen,
  UserPlus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  bulkAddTag,
  bulkDelete,
  bulkRemoveTag,
  bulkSetChannel,
  bulkSetStatus,
  createChannel,
  createContactAction,
  deleteChannel,
  getContactSummary,
  deleteContactAction,
  importContactsAction,
  updateChannel,
  updateContactAction,
  type ContactSummary,
  type FormResult,
  type ImportResult,
} from "@/lib/actions-contacts";
import { setContactStatus } from "@/lib/actions-admin";
import { SelectAction } from "@/components/admin-client";
import { LocalTime } from "@/components/local-time";
import { Field, FormSection, IconInput, Modal, ModalFooter, PillGroup } from "@/components/form-kit";
import { COUNTRIES, countryName, defaultTzOf, flag, HOME_TZ, inferFromPhone, offsetLabel, cityOf, zonesOf } from "@/lib/timezones";
import { APPT_STATUS, CONTACT_STATUS, cn, initials, eur, INTERACTION_ICONS, num, PAYMENT_STATUS, SOURCES } from "@/lib/utils";

export type ContactRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  source: string;
  status: string;
  createdAt: string;
  lastActivity: string | null;
  notes: string | null;
  channelId: number | null;
  referredBy: string | null;
  country: string | null;
  timezone: string | null;
  tags: { id: number; name: string; color: string }[];
};

export type ChannelOption = { id: number; name: string; color: string };

export type ContactData = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  source: string;
  status: string;
  notes: string | null;
  channelId: number | null;
  referredBy: string | null;
  country: string | null;
  timezone: string | null;
};

const STATUS_OPTIONS = Object.entries(CONTACT_STATUS).map(([value, s]) => ({ value, label: s.label }));
const SOURCE_OPTIONS = Object.entries(SOURCES).map(([value, label]) => ({ value, label }));

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "2-digit" });

function relative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return shortDate(iso);
}

/* ------------------------------ TABELA ---------------------------------- */

export function ContactsTable({
  rows,
  allTags,
  channels,
}: {
  rows: ContactRow[];
  allTags: { id: number; name: string }[];
  channels: ChannelOption[];
}) {
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastRows, setLastRows] = useState(rows);
  const [pending, start] = useTransition();
  const [newTag, setNewTag] = useState("");
  const [peek, setPeek] = useState<number | null>(null);
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  // Mudou a página/filtro: limpa a selecção
  if (rows !== lastRows) {
    setLastRows(rows);
    setSelected(new Set([...selected].filter((id) => rows.some((r) => r.id === id))));
  }

  const ids = [...selected];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-3 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-plum/30 bg-white p-3 shadow-[0_10px_30px_-12px_rgba(24,24,27,0.25)]">
          <span className="flex items-center gap-2 px-2 text-sm font-semibold text-zinc-900">
            {pending && <Loader2 size={14} className="animate-spin text-plum" />}
            {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
          </span>
          <select
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              e.target.value = "";
              if (v) run(() => bulkSetStatus(ids, v));
            }}
            className="field !w-auto !py-2 !text-xs"
          >
            <option value="" disabled>
              Mudar estado…
            </option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTag.trim()) return;
              const t = newTag;
              setNewTag("");
              run(() => bulkAddTag(ids, t));
            }}
            className="flex items-center gap-1"
          >
            <input
              list="contact-tags"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Adicionar tag…"
              className="field !w-40 !py-2 !text-xs"
            />
            <datalist id="contact-tags">
              {allTags.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
            <button type="submit" disabled={pending || !newTag.trim()} className="btn-ghost !px-3 !py-2 !text-xs disabled:opacity-40">
              <Tag size={13} /> Aplicar
            </button>
          </form>
          <select
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const v = Number(e.target.value);
              e.target.value = "";
              if (v) run(() => bulkRemoveTag(ids, v));
            }}
            className="field !w-auto !py-2 !text-xs"
          >
            <option value="" disabled>
              Remover tag…
            </option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              e.target.value = "";
              if (v) run(() => bulkSetChannel(ids, v === "nenhum" ? null : Number(v)));
            }}
            className="field !w-auto !py-2 !text-xs"
          >
            <option value="" disabled>
              Definir canal…
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="nenhum">Sem canal</option>
          </select>
          <a
            href={`/admin/crm/export?ids=${ids.join(",")}`}
            download
            className="btn-ghost !px-3 !py-2 !text-xs"
          >
            <Download size={13} /> Exportar
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Apagar ${selected.size} contacto(s)? O histórico e as conversas associadas também são apagados. Contactos com pagamentos são mantidos. Esta acção não pode ser desfeita.`)) return;
              run(async () => {
                const r = await bulkDelete(ids);
                setSelected(new Set());
                if (r.blocked) {
                  alert(`${r.deleted} apagado(s). ${r.blocked} mantido(s) porque têm pagamentos registados — marque-os como Inativo.`);
                }
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <Trash2 size={13} /> Apagar
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            title="Limpar selecção"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="table-shell">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="admin-th w-10">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={allChecked}
                  onChange={() =>
                    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
                  }
                  className="h-4 w-4 cursor-pointer accent-[#800080]"
                />
              </th>
              <th className="admin-th">Contacto</th>
              <th className="admin-th hidden lg:table-cell">Origem · canal</th>
              <th className="admin-th hidden xl:table-cell">Tags</th>
              <th className="admin-th">Estado</th>
              <th className="admin-th hidden whitespace-nowrap lg:table-cell">Actividade</th>
              <th className="admin-th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((c) => (
              <tr key={c.id} className={cn("transition-colors hover:bg-zinc-50", selected.has(c.id) && "bg-plum/[0.04]")}>
                <td className="admin-td">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${c.name}`}
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 cursor-pointer accent-[#800080]"
                  />
                </td>
                <td className="admin-td">
                  <button
                    type="button"
                    onClick={() => setPeek(c.id)}
                    className="group/name flex max-w-[250px] items-center gap-3 text-left"
                    title="Resumo rápido"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum/10 text-[11px] font-bold text-plum">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-zinc-950 group-hover/name:text-plum">{c.name}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {c.country && <span title={countryName(c.country)}>{flag(c.country)} </span>}
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="admin-td hidden lg:table-cell">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {SOURCES[c.source] ?? c.source}
                  </span>
                  {c.channelId && channelById.get(c.channelId) && (
                    <ChannelChip channel={channelById.get(c.channelId)!} className="mt-1" />
                  )}
                </td>
                <td className="admin-td hidden xl:table-cell">
                  <div className="flex max-w-[240px] flex-wrap gap-1.5">
                    {c.tags.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={{ borderColor: `${t.color}66`, backgroundColor: `${t.color}14`, color: "#3f3f46" }}
                      >
                        {t.name}
                      </span>
                    ))}
                    {c.tags.length > 3 && (
                      <span className="text-[10px] font-semibold text-zinc-500">+{c.tags.length - 3}</span>
                    )}
                    {c.tags.length === 0 && <span className="text-xs text-zinc-500">—</span>}
                  </div>
                </td>
                <td className="admin-td">
                  <SelectAction
                    value={c.status}
                    options={STATUS_OPTIONS}
                    onSelect={async (v) => {
                      await setContactStatus(c.id, v);
                      router.refresh();
                    }}
                  />
                </td>
                <td className="admin-td hidden whitespace-nowrap text-xs text-zinc-500 lg:table-cell">
                  {relative(c.lastActivity ?? c.createdAt)}
                </td>
                <td className="admin-td">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setPeek(c.id)}
                      className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-plum"
                      title="Resumo rápido"
                    >
                      <Eye size={15} />
                    </button>
                    <ContactFormButton
                      contact={c}
                      channels={channels}
                      trigger={
                        <span className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-plum" title="Editar">
                          <Pencil size={15} />
                        </span>
                      }
                    />
                    <Link href={`/admin/crm/${c.id}`} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-plum" title="Abrir ficha">
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ContactQuickView ids={rowIds} openId={peek} onChange={setPeek} />
    </>
  );
}

/* --------------------------- MODAL GENÉRICO ------------------------------ */

// A janela modal vive em form-kit; reexportada para os imports existentes
export { Modal };

const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";

/* ------------------------- CRIAR / EDITAR CONTACTO ----------------------- */

export function ContactFormButton({
  contact,
  trigger,
  channels,
  defaultOpen = false,
}: {
  contact?: ContactData;
  trigger: React.ReactNode;
  channels: ChannelOption[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {trigger}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={contact ? "Editar contacto" : "Novo contacto"}
        description={contact ? "Dados, origem e relacionamento" : "Basta o nome e um email ou telefone"}
        icon={contact ? UserPen : UserPlus}
        size="lg"
      >
        <ContactForm contact={contact} channels={channels} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

const SOURCE_ICONS: Record<string, LucideIcon> = {
  site: Globe,
  whatsapp: MessageCircle,
  hotmart: CreditCard,
  social: AtSign,
  referral: Users,
  manual: PenLine,
};
const STATUS_COLORS: Record<string, string> = {
  lead: "#0284c7",
  qualified: "#7c3aed",
  negotiating: "#d97706",
  client: "#059669",
  inactive: "#71717a",
  lost: "#e11d48",
};

function ContactForm({
  contact,
  channels,
  onDone,
}: {
  contact?: ContactData;
  channels: ChannelOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(contact?.name ?? "");
  const [channel, setChannel] = useState(contact?.channelId ? String(contact.channelId) : "");
  const action = contact ? updateContactAction.bind(null, contact.id) : createContactAction;
  const [state, formAction, pending] = useActionState<FormResult | null, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) {
      onDone();
      router.refresh();
    }
    return r;
  }, null);

  return (
    // Submissão manual: um erro (ex: contacto duplicado) não apaga o que foi escrito
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {/* Pré-visualização do contacto */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-plum/15 bg-plum/[0.04] p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-plum font-display text-lg font-semibold text-white">
          {name.trim() ? initials(name) : <UserRound size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo *"
            aria-label="Nome"
            className="w-full bg-transparent font-display text-2xl tracking-[-0.01em] text-zinc-950 outline-none placeholder:text-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            {contact ? `${SOURCES[contact.source] ?? contact.source} · ${CONTACT_STATUS[contact.status]?.label ?? contact.status}` : "Novo contacto"}
          </p>
        </div>
      </div>

      <FormSection icon={Contact2} title="Contactos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <IconInput icon={Mail}>
              <input name="email" type="email" defaultValue={contact?.email ?? ""} placeholder="nome@email.com" className="field" />
            </IconInput>
          </Field>
          <Field label="Telefone / WhatsApp" hint="Com indicativo: +351, +55…">
            <IconInput icon={Phone}>
              <input name="phone" defaultValue={contact?.phone ?? ""} placeholder="+351 912 345 678" className="field" />
            </IconInput>
          </Field>
        </div>
      </FormSection>

      <FormSection icon={MapPin} title="Localização">
        <Field label="Cidade">
          <IconInput icon={Building2}>
            <input name="location" defaultValue={contact?.location ?? ""} placeholder="Lisboa, São Paulo…" className="field" />
          </IconInput>
        </Field>
        <LocaleFields contact={contact} />
      </FormSection>

      <FormSection icon={Compass} title="De onde veio">
        <Field label="Origem">
          <PillGroup
            name="source"
            defaultValue={contact?.source ?? "manual"}
            options={SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: SOURCE_ICONS[o.value] }))}
          />
        </Field>
        <Field label="Canal de origem">
          <PillGroup
            name="channelId"
            value={channel}
            onChange={setChannel}
            options={[
              { value: "", label: "Sem canal" },
              ...channels.map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
              { value: "new", label: "Novo canal", icon: Plus },
            ]}
          />
          {channel === "new" && (
            <div className="mt-2.5">
              <IconInput icon={Tag}>
                <input name="newChannel" autoFocus placeholder="Nome do canal — ex: BNI Lisboa" className="field" />
              </IconInput>
            </div>
          )}
        </Field>
        <Field label="Indicado por">
          <IconInput icon={Handshake}>
            <input name="referredBy" defaultValue={contact?.referredBy ?? ""} placeholder="Quem indicou (opcional)" className="field" />
          </IconInput>
        </Field>
      </FormSection>

      <FormSection icon={HeartHandshake} title="Relacionamento">
        {contact && (
          <Field label="Estado">
            <PillGroup
              name="status"
              defaultValue={contact.status}
              options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, color: STATUS_COLORS[o.value] }))}
            />
          </Field>
        )}
        <Field label="Notas internas" hint="Só a equipa vê estas notas.">
          <textarea name="notes" rows={3} defaultValue={contact?.notes ?? ""} placeholder="Contexto, preferências, próximos passos…" className="field resize-y" />
        </Field>
      </FormSection>

      <ModalFooter
        error={
          state?.error
            ? `${state.error}${state.id ? " " : ""}`
            : undefined
        }
      >
        {state?.id && state.error && (
          <Link href={`/admin/crm/${state.id}`} className="mr-auto text-xs font-semibold text-plum hover:underline">
            Ver contacto existente
          </Link>
        )}
        <button type="button" onClick={onDone} className="btn-ghost !px-5 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn-primary !px-6 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {contact ? "Guardar alterações" : "Criar contacto"}
        </button>
      </ModalFooter>
    </form>
  );
}

export function NewContactButton({ channels, defaultOpen }: { channels: ChannelOption[]; defaultOpen?: boolean }) {
  return (
    <ContactFormButton
      channels={channels}
      defaultOpen={defaultOpen}
      trigger={
        <span className="btn-primary !px-5 !py-2.5 !text-xs">
          <Plus size={14} /> Novo contacto
        </span>
      }
    />
  );
}

/* ------------------------------ IMPORTAR -------------------------------- */

export function ImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost !px-5 !py-2.5 !text-xs">
        <Upload size={14} /> Importar CSV
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Importar contactos" description="Ficheiro CSV exportado do Excel ou Google Sheets" icon={Upload}>
        <ImportForm onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ImportResult | null, FormData>(importContactsAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">{state.created} contacto(s) importado(s).</p>
          {!!state.skipped && (
            <p className="mt-1 text-emerald-700">
              {state.skipped} linha(s) ignorada(s) — já existiam ou estavam incompletas.
            </p>
          )}
        </div>
        {!!state.problems?.length && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary !px-5 !py-2.5 !text-xs">
            Concluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm leading-relaxed text-zinc-600">
        Ficheiro CSV (Excel → Guardar como → CSV) com uma linha de cabeçalho. Colunas reconhecidas:
      </p>
      <p className="rounded-xl bg-zinc-50 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-700">
        Nome; Email; Telefone; Localização; Origem; Tags; Notas
      </p>
      <p className="text-xs leading-relaxed text-zinc-500">
        Obrigatório: Nome + (Email ou Telefone). Várias tags separadas por vírgula. Contactos
        com email ou telefone já existentes são ignorados. O ficheiro exportado desta página
        pode ser reimportado.
      </p>
      <input
        name="file"
        type="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-plum/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-plum hover:file:bg-plum/15"
      />
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost !px-5 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs">
          {pending && <Loader2 size={14} className="animate-spin" />}
          Importar
        </button>
      </div>
    </form>
  );
}

/* ------------------------------- APAGAR --------------------------------- */

export function DeleteContactButton({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Apagar "${name}"? O histórico e as conversas de WhatsApp deste contacto também são apagados. Esta acção não pode ser desfeita.`)) return;
        start(async () => {
          const r = await deleteContactAction(id);
          if (r?.error) alert(r.error);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-5 py-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Apagar
    </button>
  );
}

/* --------------------------- PAINEL RÁPIDO ------------------------------ */

const eurFmt = eur;
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Resumo lateral de um contacto, com o resto da página desfocado.
 * Setas ↑/↓ (ou J/K) passam ao contacto anterior/seguinte da lista; Esc fecha.
 */
export function ContactQuickView({
  ids,
  openId,
  onChange,
}: {
  ids: number[];
  openId: number | null;
  onChange: (id: number | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cache = useRef(new Map<number, ContactSummary | null>());
  const [data, setData] = useState<{ id: number; summary: ContactSummary | null } | null>(null);

  const load = useCallback(async (id: number) => {
    if (cache.current.has(id)) return cache.current.get(id)!;
    const s = await getContactSummary(id);
    cache.current.set(id, s);
    return s;
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (openId !== null && !d.open) d.showModal();
    if (openId === null && d.open) d.close();
    if (openId === null) return;
    let alive = true;
    void load(openId).then((summary) => alive && setData({ id: openId, summary }));
    // Pré-carrega os vizinhos para a navegação com as setas ser imediata
    const i = ids.indexOf(openId);
    for (const n of [ids[i - 1], ids[i + 1]]) if (n !== undefined) void load(n);
    return () => {
      alive = false;
    };
  }, [openId, ids, load]);

  const step = (dir: 1 | -1) => {
    if (openId === null) return;
    const next = ids[ids.indexOf(openId) + dir];
    if (next !== undefined) onChange(next);
  };

  const s = data && data.id === openId ? data.summary : undefined;
  const pos = openId !== null ? ids.indexOf(openId) : -1;

  return (
    <dialog
      ref={ref}
      onClose={() => onChange(null)}
      onClick={(e) => e.target === ref.current && onChange(null)}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input, textarea, select")) return;
        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          step(1);
        } else if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          step(-1);
        }
      }}
      className="drawer m-0 ml-auto h-dvh max-h-none w-full max-w-[460px] border-l border-zinc-200 bg-white p-0 text-left text-zinc-900 shadow-2xl backdrop:bg-zinc-950/25 backdrop:backdrop-blur-md"
    >
      {openId !== null && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3">
            <button type="button" onClick={() => step(-1)} disabled={pos <= 0} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" aria-label="Contacto anterior">
              <ChevronUp size={17} />
            </button>
            <button type="button" onClick={() => step(1)} disabled={pos >= ids.length - 1} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" aria-label="Contacto seguinte">
              <ChevronDown size={17} />
            </button>
            <span className="text-xs tabular-nums text-zinc-500">
              {pos + 1} de {ids.length}
            </span>
            <span className="hidden text-[11px] text-zinc-400 sm:inline">· ↑ ↓ para navegar</span>
            <button type="button" onClick={() => onChange(null)} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {s === undefined ? (
              <QuickViewSkeleton />
            ) : s === null ? (
              <p className="p-6 text-sm text-zinc-500">Este contacto já não existe.</p>
            ) : (
              <QuickViewBody key={s.contact.id} s={s} />
            )}
          </div>
          {s && (
            <div className="flex gap-2 border-t border-zinc-200 p-4">
              <Link href={`/admin/crm/${s.contact.id}`} className="btn-primary flex-1 !py-2.5 !text-xs">
                Abrir ficha completa <ArrowUpRight size={14} />
              </Link>
              {s.contact.phone && (
                <Link href={`/admin/whatsapp?c=${s.contact.id}`} className="btn-ghost !px-4 !py-2.5 !text-xs" title="Conversa WhatsApp">
                  <MessageCircle size={14} />
                </Link>
              )}
              {s.contact.email && (
                <a href={`mailto:${s.contact.email}`} className="btn-ghost !px-4 !py-2.5 !text-xs" title="Enviar email">
                  <Mail size={14} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

function QuickViewSkeleton() {
  return (
    <div className="space-y-5 p-6" aria-busy="true">
      <div className="flex items-center gap-4">
        <div className="skeleton h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-12" />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function QuickViewBody({ s }: { s: ContactSummary }) {
  const c = s.contact;
  const st = CONTACT_STATUS[c.status];
  return (
    <div className="animate-fade-in">
      <div className="px-6 pb-5 pt-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-plum text-lg font-bold text-white">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight text-zinc-950">{c.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className={cn("chip !py-0.5", st?.className)}>{st?.label ?? c.status}</span>
              {SOURCES[c.source] ?? c.source} · desde {shortDate(c.createdAt)}
            </p>
            {(c.channel || c.referredBy) && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                {c.channel && <ChannelChip channel={c.channel} />}
                {c.referredBy && <span>Indicado por <b className="font-semibold text-zinc-800">{c.referredBy}</b></span>}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          {c.timezone && (
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              <LocalTime timezone={c.timezone} country={c.country} />
            </p>
          )}
          {c.email && (
            <p className="flex items-center gap-2.5 text-zinc-700">
              <Mail size={14} className="shrink-0 text-plum" /> <span className="truncate">{c.email}</span>
            </p>
          )}
          {c.phone && (
            <p className="flex items-center gap-2.5 text-zinc-700">
              <Phone size={14} className="shrink-0 text-plum" /> {c.phone}
            </p>
          )}
          {(c.location || c.country) && (
            <p className="flex items-center gap-2.5 text-zinc-700">
              <MapPin size={14} className="shrink-0 text-plum" />
              {[c.location, c.country ? `${flag(c.country)} ${countryName(c.country)}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {s.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {s.tags.map((t) => (
              <span
                key={t.name}
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{ borderColor: `${t.color}66`, backgroundColor: `${t.color}14`, color: "#3f3f46" }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-6 pb-5">
        {[
          { label: "Investido", value: eurFmt(s.stats.spent), accent: true },
          { label: "Pendente", value: eurFmt(s.stats.pending) },
          { label: "Sessões", value: String(s.stats.sessions) },
        ].map((k) => (
          <div key={k.label} className={cn("rounded-xl border px-3 py-2.5", k.accent ? "border-plum/20 bg-plum/[0.05]" : "border-zinc-200 bg-zinc-50")}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{k.label}</p>
            <p className={cn("mt-0.5 truncate text-sm font-bold tabular-nums", k.accent ? "text-plum" : "text-zinc-950")}>{k.value}</p>
          </div>
        ))}
      </div>

      {s.nextAppointment && (
        <div className="mx-6 mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CalendarDays size={16} className="shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-emerald-900">Próxima: {s.nextAppointment.name}</p>
            <p className="text-xs text-emerald-800">{dateTime(s.nextAppointment.startAt)}</p>
          </div>
          {s.nextAppointment.meetingUrl && (
            <a href={s.nextAppointment.meetingUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-800 hover:underline">
              Link
            </a>
          )}
        </div>
      )}

      {c.notes && (
        <Section title="Notas">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">{c.notes}</p>
        </Section>
      )}

      {s.whatsapp.last && (
        <Section title={`WhatsApp${s.whatsapp.unread ? ` · ${s.whatsapp.unread} por ler` : ""}`}>
          <div className={cn("rounded-xl px-3.5 py-2.5 text-sm", s.whatsapp.last.direction === "in" ? "bg-zinc-100 text-zinc-800" : "ml-8 bg-plum/10 text-zinc-800")}>
            <p className="line-clamp-3">{s.whatsapp.last.body}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{dateTime(s.whatsapp.last.createdAt)}</p>
          </div>
        </Section>
      )}

      {s.courses.length > 0 && (
        <Section title="Cursos">
          <ul className="space-y-2.5">
            {s.courses.map((co) => {
              const pct = co.total ? Math.round((co.done / co.total) * 100) : 0;
              return (
                <li key={co.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium text-zinc-800">{co.title}</span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-plum">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-plum" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {(s.payments.length > 0 || s.deals.length > 0) && (
        <Section title="Compras e negócios">
          <ul className="space-y-2">
            {s.payments.map((p) => (
              <li key={`p${p.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-zinc-800">{p.product}</span>
                  <span className="text-[11px] text-zinc-500">
                    {shortDate(p.createdAt)} · {PAYMENT_STATUS[p.status]?.label ?? p.status}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-zinc-950">{eurFmt(p.amount)}</span>
              </li>
            ))}
            {s.deals.map((d) => (
              <li key={`d${d.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-zinc-800">{d.title}</span>
                  <span className="text-[11px] text-zinc-500">Pipeline · {d.stage}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-plum">{eurFmt(d.value)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {s.appointments.length > 0 && (
        <Section title="Agendamentos">
          <ul className="space-y-2">
            {s.appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-zinc-800">{a.name}</span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {dateTime(a.startAt)} · {APPT_STATUS[a.status]?.label ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Actividade recente">
        {s.timeline.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem interações registadas.</p>
        ) : (
          <ul className="relative space-y-3 before:absolute before:bottom-1 before:left-[4px] before:top-1 before:w-px before:bg-zinc-200">
            {s.timeline.map((i) => (
              <li key={i.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-[9px] w-[9px] rounded-full border-2 border-plum bg-white" />
                <p className="line-clamp-2 text-sm text-zinc-700">{i.content}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  {INTERACTION_ICONS[i.type] ?? i.type} · {relative(i.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* -------------------------------- CANAIS -------------------------------- */

export function ChannelChip({ channel, className }: { channel: { name: string; color: string }; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", className)}
      style={{ borderColor: `${channel.color}55`, backgroundColor: `${channel.color}12`, color: channel.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: channel.color }} />
      {channel.name}
    </span>
  );
}

/** Lista editável de canais (nome e cor), com criação e remoção. */
export function ChannelManager({ channels }: { channels: (ChannelOption & { count: number })[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && r.error) setError(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {channels.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <input
              type="color"
              defaultValue={c.color}
              onChange={(e) => {
                const color = e.target.value;
                run(() => updateChannel(c.id, c.name, color));
              }}
              className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-white p-0.5"
              aria-label={`Cor de ${c.name}`}
            />
            <input
              defaultValue={c.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) run(() => updateChannel(c.id, v, c.color));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="field !border-transparent !bg-transparent !px-2 !py-1 font-semibold hover:!border-zinc-200 focus:!bg-white"
            />
            <Link href={`/admin/contactos?canal=${c.id}`} className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-plum">
              {num(c.count)} contacto{c.count === 1 ? "" : "s"}
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                confirm(`Apagar o canal “${c.name}”? ${c.count ? `Os ${c.count} contacto(s) ficam sem canal.` : ""}`) &&
                run(() => deleteChannel(c.id))
              }
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label={`Apagar ${c.name}`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {channels.length === 0 && <p className="text-sm text-zinc-500">Ainda não há canais.</p>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = name;
          setName("");
          run(() => createChannel(v));
        }}
        className="flex gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo canal (ex: BNI Lisboa Centro)" className="field" />
        <button type="submit" disabled={pending || !name.trim()} className="btn-primary shrink-0 !px-4 !py-2.5 !text-xs disabled:opacity-50">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
        </button>
      </form>
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

/* ----------------------------- PAÍS E FUSO ------------------------------ */

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ code: c.code, name: countryName(c.code) })).sort((a, b) =>
  a.name.localeCompare(b.name, "pt")
);

/**
 * País e fuso do contacto. Escolher o país sugere o fuso; países com vários fusos
 * (Brasil, EUA, Portugal com ilhas) mostram as opções. Vazio = deduzido do telefone ao guardar.
 */
function LocaleFields({ contact }: { contact?: ContactData }) {
  const [country, setCountry] = useState(contact?.country ?? "");
  const [tz, setTz] = useState(contact?.timezone ?? "");
  const zones = zonesOf(country);
  const knownCountry = COUNTRY_OPTIONS.some((c) => c.code === country);
  const guess = !contact?.country && contact?.phone ? inferFromPhone(contact.phone) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="País">
        <IconInput icon={Flag}>
          <select
            name="country"
            value={country}
            onChange={(e) => {
              const c = e.target.value;
              setCountry(c);
              setTz(defaultTzOf(c) ?? "");
            }}
            className="field"
          >
            <option value="">{guess ? `Automático (${flag(guess.country)} ${countryName(guess.country)})` : "Automático pelo telefone"}</option>
            {!knownCountry && country && (
              <option value={country}>
                {flag(country)} {countryName(country)}
              </option>
            )}
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {flag(c.code)} {c.name}
              </option>
            ))}
          </select>
        </IconInput>
      </Field>
      <Field label="Fuso horário" hint={tz ? `${cityOf(tz)} · ${offsetLabel(tz)}` : "Preenchido a partir do país ou do telefone"}>
        <IconInput icon={Clock3}>
          {zones ? (
            <select name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} className="field">
              {zones.map((z) => (
                <option key={z.tz} value={z.tz}>
                  {z.label} ({offsetLabel(z.tz)})
                </option>
              ))}
            </select>
          ) : (
            <input name="timezone" value={tz} readOnly={Boolean(country)} onChange={(e) => setTz(e.target.value)} className="field" placeholder={HOME_TZ} />
          )}
        </IconInput>
      </Field>
    </div>
  );
}
