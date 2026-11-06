"use client";

import { startTransition, useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CheckCheck,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailOpen,
  Plus,
  Save,
  Send,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { Field, FormSection, Modal, ModalFooter, PillGroup, ToggleRow } from "@/components/form-kit";
import { FieldInput } from "@/components/form-public";
import {
  createForm,
  deleteForm,
  deleteSubmission,
  duplicateForm,
  markAllRead,
  saveFormContent,
  saveFormSettings,
  setSubmissionStatus,
  toggleForm,
  type FormResult,
} from "@/lib/actions-forms";
import { blankField, FIELD_TYPES, hasOptions, LOCKED_FIELDS, type FieldType, type FormAnswer, type FormField } from "@/lib/forms-def";
import { cn } from "@/lib/utils";

const iconBtn = "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-plum disabled:pointer-events-none disabled:opacity-30";

/* ----------------------------- LISTA DE FORMS ---------------------------- */

export function NewFormButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(async (prev: FormResult | null, fd: FormData) => {
    const r = await createForm(prev, fd);
    if (r.ok && r.id) router.push(`/admin/formularios/${r.id}?tab=editor`);
    return r;
  }, null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 !text-xs">
        <Plus size={14} /> Novo formulário
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo formulário" description="Começa com nome, email, telefone e mensagem. Depois ajusta tudo." icon={ClipboardList}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => run(fd));
          }}
        >
          <Field label="Nome do formulário" required hint="Também vira o endereço da página e a etiqueta dos contactos. Pode mudar depois.">
            <input name="name" data-autofocus required maxLength={120} className="field" placeholder="Ex.: Lista de espera da mentoria" />
          </Field>
          <ModalFooter error={state?.error}>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-4 !py-2 !text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2 !text-xs disabled:opacity-60">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

export function FormActions({ id, name, active, system, responses, afterDelete }: { id: number; name: string; active: boolean; system: boolean; responses: number; afterDelete?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-0.5">
      {error && <span className="mr-2 text-[11px] font-semibold text-rose-600">{error}</span>}
      {pending && <Loader2 size={14} className="mr-1 animate-spin text-zinc-400" />}
      {!system && (
        <button
          type="button"
          title={active ? "Desativar (a página deixa de abrir)" : "Ativar"}
          aria-label={active ? "Desativar" : "Ativar"}
          onClick={() => start(() => toggleForm(id))}
          className={iconBtn}
        >
          {active ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      )}
      <button
        type="button"
        title="Duplicar"
        aria-label="Duplicar"
        onClick={() =>
          start(async () => {
            const r = await duplicateForm(id);
            if (r.ok && r.id) router.push(`/admin/formularios/${r.id}?tab=editor`);
            else setError(r.error ?? null);
          })
        }
        className={iconBtn}
      >
        <Copy size={15} />
      </button>
      {!system && (
        <button
          type="button"
          title="Apagar"
          aria-label="Apagar"
          onClick={() => {
            const extra = responses ? ` As ${responses} respostas também são apagadas; os contactos ficam.` : "";
            if (!confirm(`Apagar o formulário “${name}”?${extra}`)) return;
            start(async () => {
              const r = await deleteForm(id);
              if (!r.ok) setError(r.error ?? null);
              else if (afterDelete) router.push(afterDelete);
            });
          }}
          className={cn(iconBtn, "hover:text-rose-600")}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/* -------------------------------- RESPOSTAS ------------------------------ */

export type SubmissionRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  answers: FormAnswer[];
  status: string;
  origin: string | null;
  contactId: number | null;
  when: string;
};

const summary = (s: SubmissionRow) =>
  s.answers
    .filter((a) => a.id !== "name" && a.id !== "email" && a.value !== s.phone)
    .map((a) => a.value)
    .join(" · ");

export function MarkAllReadButton({ formId }: { formId: number }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => markAllRead(formId))} className="btn-ghost !px-3.5 !py-2 !text-xs disabled:opacity-60">
      {pending ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />} Marcar tudo como lido
    </button>
  );
}

export function SubmissionsTable({ rows }: { rows: SubmissionRow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const open = rows.find((r) => r.id === openId) ?? null;

  const show = (r: SubmissionRow) => {
    setOpenId(r.id);
    if (r.status === "new") start(() => setSubmissionStatus(r.id, "read"));
  };
  const act = (fn: () => Promise<void>) => {
    setOpenId(null);
    start(fn);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="admin-th">Pessoa</th>
              <th className="admin-th">Resposta</th>
              <th className="admin-th">Origem</th>
              <th className="admin-th">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => show(r)} className="cursor-pointer transition-colors hover:bg-zinc-50">
                <td className="admin-td">
                  <span className="flex items-center gap-2.5">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", r.status === "new" ? "bg-plum" : "bg-transparent")} />
                    <span className="min-w-0">
                      <span className={cn("block truncate text-zinc-900", r.status === "new" && "font-semibold")}>{r.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{r.email}</span>
                    </span>
                  </span>
                </td>
                <td className="admin-td max-w-[320px]">
                  <span className="block truncate text-xs text-zinc-500">{summary(r) || "—"}</span>
                </td>
                <td className="admin-td whitespace-nowrap text-xs text-zinc-500">{r.origin || "Direto"}</td>
                <td className="admin-td whitespace-nowrap text-xs tabular-nums text-zinc-500">{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ""} description={open ? `${open.when} · ${open.origin || "Acesso direto"}` : undefined} icon={ClipboardList}>
        {open && (
          <>
            <dl className="space-y-3.5">
              {open.answers.map((a) => (
                <div key={a.id}>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">{a.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-800">{a.value}</dd>
                </div>
              ))}
            </dl>
            <ModalFooter>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Apagar esta resposta? O contacto fica no CRM.")) act(() => deleteSubmission(open.id));
                }}
                className="mr-auto rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label="Apagar resposta"
                title="Apagar resposta"
              >
                <Trash2 size={15} />
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => setSubmissionStatus(open.id, "new"))} className="btn-ghost !px-3.5 !py-2 !text-xs">
                <MailOpen size={13} /> Marcar por ler
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => setSubmissionStatus(open.id, open.status === "archived" ? "read" : "archived"))}
                className="btn-ghost !px-3.5 !py-2 !text-xs"
              >
                {open.status === "archived" ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                {open.status === "archived" ? "Restaurar" : "Arquivar"}
              </button>
              {open.contactId && (
                <Link href={`/admin/crm/${open.contactId}`} className="btn-primary !px-4 !py-2 !text-xs">
                  <UserRound size={13} /> Abrir contacto
                </Link>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}

/* --------------------------------- EDITOR -------------------------------- */

type Content = { kicker: string; title: string; description: string; button: string; fields: FormField[] };

export function FormBuilder({ id, system, initial }: { id: number; system: boolean; initial: Content }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [openField, setOpenField] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormResult | null>(null);
  const dirty = useMemo(() => JSON.stringify(c) !== saved, [c, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<Content>) => {
    setResult(null);
    setC((v) => ({ ...v, ...patch }));
  };
  const setField = (fid: string, patch: Partial<FormField>) => set({ fields: c.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });
  const move = (i: number, by: number) => {
    const next = [...c.fields];
    const [f] = next.splice(i, 1);
    next.splice(i + by, 0, f);
    set({ fields: next });
  };
  const add = (type: FieldType) => {
    const f = blankField(type);
    set({ fields: [...c.fields, f] });
    setOpenField(f.id);
  };
  const save = () =>
    start(async () => {
      const r = await saveFormContent(id, c);
      setResult(r);
      if (r.ok) {
        setSaved(JSON.stringify(c));
        router.refresh();
      }
    });

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <section className="card p-6">
          <FormSection icon={Sparkles} title="Textos da página">
            {system ? (
              <p className="text-xs text-zinc-500">O título da página Contacto edita-se em Site → Contacto.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-[0.6fr_1fr]">
                  <Field label="Etiqueta">
                    <input value={c.kicker} onChange={(e) => set({ kicker: e.target.value })} maxLength={60} className="field" />
                  </Field>
                  <Field label="Título" required hint="Palavras entre *asteriscos* ficam em itálico.">
                    <input value={c.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} className="field" />
                  </Field>
                </div>
                <Field label="Texto de apresentação">
                  <textarea value={c.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} className="field resize-y" />
                </Field>
              </>
            )}
            <Field label="Texto do botão" required>
              <input value={c.button} onChange={(e) => set({ button: e.target.value })} maxLength={60} className="field" />
            </Field>
          </FormSection>
        </section>

        <section className="card p-6">
          <FormSection icon={ClipboardList} title={`Campos (${c.fields.length})`}>
            <ul className="space-y-2">
              {c.fields.map((f, i) => {
                const locked = LOCKED_FIELDS.includes(f.id);
                const isOpen = openField === f.id;
                return (
                  <li key={f.id} className={cn("rounded-2xl border bg-white transition-colors", isOpen ? "border-plum/40" : "border-line")}>
                    <div className="flex items-center gap-1 py-1.5 pl-3.5 pr-2">
                      <button type="button" onClick={() => setOpenField(isOpen ? null : f.id)} className="min-w-0 flex-1 py-1 text-left">
                        <span className="block truncate text-sm font-semibold text-zinc-800">
                          {f.label || "Sem título"}
                          {f.required && <span className="text-plum"> *</span>}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          {locked && <Lock size={10} />}
                          {locked ? "Obrigatório para criar o contacto" : FIELD_TYPES.find((t) => t.value === f.type)?.label}
                        </span>
                      </button>
                      <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className={iconBtn}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label="Descer" disabled={i === c.fields.length - 1} onClick={() => move(i, 1)} className={iconBtn}>
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Remover campo"
                        disabled={locked}
                        onClick={() => set({ fields: c.fields.filter((x) => x.id !== f.id) })}
                        className={cn(iconBtn, "hover:text-rose-600")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="space-y-3.5 border-t border-line px-3.5 py-4">
                        <Field label={f.type === "consent" ? "Texto da autorização" : "Título do campo"} required>
                          <input value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} maxLength={300} className="field" />
                        </Field>
                        {f.type !== "consent" && f.type !== "radio" && f.type !== "checkbox" && f.type !== "date" && (
                          <Field label={f.type === "select" ? "Texto antes de escolher" : "Texto de exemplo"}>
                            <input value={f.placeholder} onChange={(e) => setField(f.id, { placeholder: e.target.value })} maxLength={150} className="field" />
                          </Field>
                        )}
                        {hasOptions(f.type) && (
                          <Field label="Opções" required hint="Uma por linha.">
                            <textarea
                              value={f.options.join("\n")}
                              onChange={(e) => setField(f.id, { options: e.target.value.split("\n") })}
                              rows={Math.min(8, f.options.length + 1)}
                              className="field resize-y"
                            />
                          </Field>
                        )}
                        <Field label="Ajuda (opcional)">
                          <input value={f.help} onChange={(e) => setField(f.id, { help: e.target.value })} maxLength={300} className="field" />
                        </Field>
                        {f.type !== "consent" && (
                          <Field label="Largura">
                            <PillGroup
                              name={`w-${f.id}`}
                              size="sm"
                              value={f.width}
                              onChange={(v) => setField(f.id, { width: v as FormField["width"] })}
                              options={[
                                { value: "full", label: "Linha inteira" },
                                { value: "half", label: "Meia linha" },
                              ]}
                            />
                          </Field>
                        )}
                        {!locked && <ToggleRow name={`r-${f.id}`} label="Obrigatório" checked={f.required} onChange={(v) => setField(f.id, { required: v })} />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div>
              <p className="mb-2 text-[12px] font-semibold text-zinc-600">Adicionar campo</p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => add(t.value)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-plum/50 hover:text-plum"
                  >
                    <Plus size={12} /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          </FormSection>
        </section>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6">
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
          {dirty && !result?.error && <span className="text-xs font-semibold text-amber-600">Alterações por guardar</span>}
          {!dirty && result?.ok && <span className="pop text-xs font-semibold text-emerald-600">Guardado e publicado</span>}
          {result?.error && <span className="text-xs font-semibold text-rose-600">{result.error}</span>}
        </div>
        <div className="card p-6">
          <p className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-400">Pré-visualização</p>
          {!system && (
            <div className="mb-6">
              <p className="font-display text-2xl leading-tight text-zinc-950">{c.title.replace(/\*/g, "")}</p>
              {c.description && <p className="mt-2 whitespace-pre-line text-sm text-zinc-500">{c.description}</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {c.fields.map((f) => (
              <FieldInput key={f.id} field={f} preview />
            ))}
          </div>
          <span className="btn-primary mt-5 pointer-events-none !px-5 !py-2.5 !text-xs">
            <Send size={13} /> {c.button || "Enviar"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- DEFINIÇÕES ------------------------------ */

export type SettingsValues = {
  name: string;
  slug: string;
  active: boolean;
  tag: string;
  channelId: number | null;
  createDeal: boolean;
  notify: boolean;
  successTitle: string;
  successText: string;
  successCtaLabel: string;
  successCtaHref: string;
  autoReply: boolean;
  autoReplySubject: string;
  autoReplyText: string;
};

export function FormSettings({
  id,
  system,
  values: v,
  channels,
  tags,
  baseUrl,
}: {
  id: number;
  system: boolean;
  values: SettingsValues;
  channels: { id: number; name: string }[];
  tags: string[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [autoReply, setAutoReply] = useState(v.autoReply);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [state, run, pending] = useActionState(async (prev: FormResult | null, fd: FormData) => {
    const r = await saveFormSettings(id, prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, null);
  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
      className="grid items-start gap-6 xl:grid-cols-2"
    >
      <section className="card p-6">
        <FormSection icon={ClipboardList} title="Formulário">
          <Field label="Nome interno" required>
            <input name="name" defaultValue={v.name} required maxLength={120} className="field" />
          </Field>
          {!system && (
            <>
              <Field label="Endereço" hint="Mudar o endereço faz com que os links já partilhados deixem de abrir.">
                <div className="flex items-center gap-2">
                  <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">{baseUrl}/formulario/</span>
                  <input name="slug" defaultValue={v.slug} maxLength={60} className="field" />
                </div>
              </Field>
              <ToggleRow name="active" label="Formulário ativo" description="Desativado, a página deixa de abrir e não recebe respostas." defaultChecked={v.active} />
            </>
          )}
        </FormSection>
        <div className="mt-6">
          <FormSection icon={Tag} title="Quando chega uma resposta">
            <Field label="Etiqueta do contacto" hint="Criada automaticamente se ainda não existir. Vazio = sem etiqueta.">
              <input name="tag" defaultValue={v.tag} list="form-tags" maxLength={60} className="field" />
              <datalist id="form-tags">
                {tags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Canal do contacto" hint="Só é aplicado a quem ainda não tem canal.">
              <select name="channelId" defaultValue={v.channelId ?? ""} className="field">
                <option value="">Sem canal</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <ToggleRow name="createDeal" label="Criar negócio no Pipeline" description="Na primeira etapa, se o contacto ainda não tiver um negócio aberto." defaultChecked={v.createDeal} />
            <ToggleRow name="notify" label="Avisar a equipa por email" description="Usa o email e o aviso de leads de Configurações → Email." defaultChecked={v.notify} />
          </FormSection>
        </div>
      </section>

      <section className="card p-6">
        <FormSection icon={CheckCheck} title="Depois de enviar">
          <Field label="Mensagem de sucesso: título" required>
            <input name="successTitle" defaultValue={v.successTitle} required maxLength={200} className="field" />
          </Field>
          <Field label="Mensagem de sucesso: texto">
            <textarea name="successText" defaultValue={v.successText} rows={3} maxLength={1000} className="field resize-y" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Botão: texto (opcional)">
              <input name="successCtaLabel" defaultValue={v.successCtaLabel} maxLength={80} className="field" />
            </Field>
            <Field label="Botão: link" hint="Ex.: /agendar ou https://...">
              <input name="successCtaHref" defaultValue={v.successCtaHref} maxLength={500} className="field" />
            </Field>
          </div>
        </FormSection>
        <div className="mt-6">
          <FormSection icon={Mail} title="Resposta automática">
            <ToggleRow name="autoReply" label="Enviar email a quem preencheu" description="Precisa do Resend configurado." checked={autoReply} onChange={setAutoReply} />
            <div className={cn("space-y-4", !autoReply && "hidden")}>
              <Field label="Assunto" required hint="{nome} é substituído pelo primeiro nome.">
                <input name="autoReplySubject" defaultValue={v.autoReplySubject} maxLength={200} className="field" />
              </Field>
              <Field label="Texto" required>
                <textarea name="autoReplyText" defaultValue={v.autoReplyText} rows={6} maxLength={5000} className="field resize-y" placeholder={"Olá {nome},\n\nRecebi a sua mensagem..."} />
              </Field>
            </div>
          </FormSection>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || !ready} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar definições
          </button>
          {state?.ok && !pending && <span className="pop text-xs font-semibold text-emerald-600">Guardado</span>}
          {state?.error && <span className="text-xs font-semibold text-rose-600">{state.error}</span>}
        </div>
      </section>
    </form>
  );
}
