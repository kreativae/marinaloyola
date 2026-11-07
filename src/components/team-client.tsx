"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Check, Copy, Contact, GraduationCap, KeyRound, Loader2, Mail, Pencil, Phone, Plus, Search, Send, ShieldCheck, ShieldOff, Smartphone, Tag, Trash2, User, UserPlus, Users, X } from "lucide-react";
import { Field, FormSection, IconInput, Modal, ModalFooter, PillGroup, ToggleRow } from "@/components/form-kit";
import { createTag, deleteTag, deleteUser, saveUser, searchContactsForAccount, setUserPassword, updateTag, type TeamResult } from "@/lib/actions-team";
import { resetUserTwoFactor } from "@/lib/actions-2fa";
import { cn, num } from "@/lib/utils";

/* ------------------------------ UTILIZADORES ----------------------------- */

export type TeamUser = { id: number; name: string; email: string; role: string; createdAt: string; twoFactor?: boolean };
export type CourseOption = { id: number; title: string };
/** Dados de um contacto do CRM para pré-preencher a conta nova. */
export type AccountPrefill = { contactId: number; name: string; email: string | null; phone: string | null };

const ROLES: Record<string, { label: string; className: string; icon: typeof Users; hint: string }> = {
  admin: { label: "Super Admin", className: "bg-plum/20 text-plum border-plum/40", icon: ShieldCheck, hint: "Acesso total, incluindo contas e configurações." },
  manager: { label: "Admin", className: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: ShieldCheck, hint: "Mesmos acessos da Equipa: usa o backoffice, sem gerir contas." },
  staff: { label: "Equipa", className: "bg-sky-500/10 text-sky-700 border-sky-500/30", icon: Users, hint: "Usa o backoffice, sem gerir contas." },
  student: { label: "Estudante", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: GraduationCap, hint: "Só a área de estudante e os cursos com inscrição." },
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function UserManager({ users, meId, canManage, courses = [] }: { users: TeamUser[]; meId: number; canManage: boolean; courses?: CourseOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [editing, setEditing] = useState<TeamUser | "new" | null>(null);
  const [pwFor, setPwFor] = useState<TeamUser | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length };
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const list = users.filter((u) => {
    if (role !== "all" && u.role !== role) return false;
    const s = q.trim().toLowerCase();
    return !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const remove = (u: TeamUser) => {
    if (!confirm(`Apagar a conta de “${u.name}”? ${u.role === "student" ? "As inscrições e o progresso nos cursos também são apagados." : ""}`)) return;
    start(async () => {
      setError(null);
      const r = await deleteUser(u.id);
      if (!r.ok) setError(r.error ?? "Não foi possível apagar.");
      router.refresh();
    });
  };

  const resetTwoFactor = (u: TeamUser) => {
    if (!confirm(`Desligar a verificação em dois passos de “${u.name}”? Volta a entrar só com a palavra-passe até a ativar outra vez.`)) return;
    start(async () => {
      setError(null);
      const r = await resetUserTwoFactor(u.id);
      if (!r.ok) setError(r.error ?? "Não foi possível desligar.");
      router.refresh();
    });
  };

  const actions = (u: TeamUser) => (
    <div className="flex justify-end gap-0.5">
      <button type="button" onClick={() => setEditing(u)} className="rounded-lg p-1.5 text-zinc-400 max-sm:p-2.5 hover:bg-white hover:text-plum" aria-label={`Editar ${u.name}`} title="Editar">
        <Pencil size={14} />
      </button>
      <button type="button" onClick={() => setPwFor(u)} className="rounded-lg p-1.5 text-zinc-400 max-sm:p-2.5 hover:bg-white hover:text-plum" aria-label={`Trocar a palavra-passe de ${u.name}`} title="Trocar palavra-passe">
        <KeyRound size={14} />
      </button>
      {u.twoFactor && u.id !== meId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => resetTwoFactor(u)}
          className="rounded-lg p-1.5 text-zinc-400 max-sm:p-2.5 hover:bg-white hover:text-amber-600"
          aria-label={`Desligar a verificação em dois passos de ${u.name}`}
          title="Desligar verificação em dois passos (perdeu o telemóvel)"
        >
          <ShieldOff size={14} />
        </button>
      )}
      <button
        type="button"
        disabled={pending || u.id === meId}
        onClick={() => remove(u)}
        className="rounded-lg p-1.5 text-zinc-400 max-sm:p-2.5 hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30"
        aria-label={`Apagar ${u.name}`}
        title={u.id === meId ? "Não pode apagar a sua própria conta" : "Apagar"}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome ou email" className="field !pl-10" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(canManage ? (["all", "admin", "manager", "staff", "student"] as const) : (["all", "manager", "staff", "student"] as const)).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                role === r ? "border-plum bg-plum text-white" : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900"
              )}
            >
              {r === "all" ? "Todos" : ROLES[r].label} <span className="opacity-60">{counts[r] ?? 0}</span>
            </button>
          ))}
        </div>
        {canManage && (
          <button type="button" onClick={() => setEditing("new")} className="btn-primary !px-4 !py-2.5 !text-xs">
            <UserPlus size={14} /> Novo utilizador
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">{error}</p>}

      {/* No telemóvel cada pessoa é um cartão: nome, perfil e ações sem deslizar para o lado */}
      <ul className="space-y-2 sm:hidden">
        {list.map((u) => {
          const r = ROLES[u.role];
          const Icon = r?.icon ?? Users;
          return (
            <li key={u.id} className="rounded-2xl border border-line bg-white p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-plum/10 text-xs font-bold text-plum">{initials(u.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-950">
                    {u.name} {u.id === meId && <span className="text-xs font-normal text-zinc-400">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{u.email}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className={`chip ${r?.className ?? ""}`}>
                    <Icon size={11} /> {r?.label ?? u.role}
                  </span>
                  {u.twoFactor && (
                    <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                      <Smartphone size={11} /> 2 passos
                    </span>
                  )}
                </span>
                {canManage && actions(u)}
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-8 text-center text-sm text-zinc-500">Nenhum utilizador encontrado.</li>}
      </ul>

      <div className="table-shell max-sm:hidden">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="admin-th">Nome</th>
              <th className="admin-th hidden sm:table-cell">Email</th>
              <th className="admin-th">Perfil</th>
              <th className="admin-th hidden md:table-cell">Desde</th>
              {canManage && <th className="admin-th w-0" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((u) => {
              const r = ROLES[u.role];
              const Icon = r?.icon ?? Users;
              return (
                <tr key={u.id} className="group transition-colors hover:bg-zinc-50">
                  <td className="admin-td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum/10 text-[11px] font-bold text-plum">{initials(u.name)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-950">
                          {u.name} {u.id === meId && <span className="text-xs font-normal text-zinc-400">(você)</span>}
                        </p>
                        <p className="truncate text-xs text-zinc-500 sm:hidden">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="admin-td hidden text-zinc-500 sm:table-cell">{u.email}</td>
                  <td className="admin-td">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`chip ${r?.className ?? ""}`}>
                        <Icon size={11} /> {r?.label ?? u.role}
                      </span>
                      {u.twoFactor && (
                        <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-700" title="Verificação em dois passos ativa">
                          <Smartphone size={11} /> 2 passos
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="admin-td hidden text-xs text-zinc-500 md:table-cell">{new Date(u.createdAt).toLocaleDateString("pt-PT")}</td>
                  {canManage && (
                    <td className="admin-td">
                      {actions(u)}
                    </td>
                  )}
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="admin-td py-8 text-center text-sm text-zinc-500">
                  Nenhum utilizador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!canManage && <p className="text-[11px] text-zinc-500">As contas são criadas e geridas pelo suporte da plataforma.</p>}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo utilizador" : "Editar utilizador"}
        description={editing === "new" ? "Crie uma conta para a equipa ou para estudantes." : editing ? editing.email : undefined}
        icon={editing === "new" ? UserPlus : Pencil}
      >
        {editing !== null && (
          <UserForm
            key={editing === "new" ? "new" : editing.id}
            user={editing === "new" ? null : editing}
            isMe={editing !== "new" && editing.id === meId}
            courses={courses}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal open={pwFor !== null} onClose={() => setPwFor(null)} title="Trocar palavra-passe" description={pwFor?.name} icon={KeyRound}>
        {pwFor && <PasswordForm key={pwFor.id} user={pwFor} onDone={() => setPwFor(null)} />}
      </Modal>
    </div>
  );
}

function UserForm({
  user,
  isMe,
  onDone,
  courses = [],
  prefill,
  defaultRole,
  lockRole,
}: {
  user: TeamUser | null;
  isMe: boolean;
  onDone: () => void;
  courses?: CourseOption[];
  prefill?: AccountPrefill;
  defaultRole?: string;
  /** Só pode criar o perfil de defaultRole (o Admin a converter um contacto). */
  lockRole?: boolean;
}) {
  const [state, action, pending] = useActionState<TeamResult | null, FormData>(saveUser.bind(null, user?.id ?? null), null);
  const [role, setRole] = useState(user?.role ?? defaultRole ?? "staff");
  const [from, setFrom] = useState<AccountPrefill | null>(prefill ?? null);
  const [name, setName] = useState(user?.name ?? prefill?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const created = !user && state?.ok;
  useEffect(() => {
    if (state?.ok && user) onDone();
  }, [state, onDone, user]);

  if (created) return <AccountCreated result={state} email={email} onDone={onDone} />;

  const pick = (c: AccountPrefill) => {
    setFrom(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setRole("student");
  };

  return (
    <form action={action}>
      {!user && !prefill && <ContactPicker selected={from} onPick={pick} onClear={() => setFrom(null)} />}
      {from && <input type="hidden" name="contactId" value={from.contactId} />}
      <FormSection icon={User} title="Dados">
        <Field label="Nome" required>
          <IconInput icon={User}>
            <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="field" data-autofocus />
          </IconInput>
        </Field>
        <div className={cn("grid gap-4", !user && "sm:grid-cols-2")}>
          <Field label="Email" required hint="É com este email que a pessoa entra na plataforma.">
            <IconInput icon={Mail}>
              <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            </IconInput>
          </Field>
          {!user && (
            <Field label="Telefone">
              <IconInput icon={Phone}>
                <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 …" className="field" />
              </IconInput>
            </Field>
          )}
        </div>
      </FormSection>
      {lockRole ? (
        <input type="hidden" name="role" value={role} />
      ) : (
        <FormSection icon={ShieldCheck} title="Perfil de acesso">
          {isMe && user?.role === "admin" ? (
            <>
              <input type="hidden" name="role" value="admin" />
              <p className="text-xs text-zinc-500">É a sua conta: o perfil de Super Admin mantém-se.</p>
            </>
          ) : (
            <>
              <PillGroup
                name="role"
                value={role}
                onChange={setRole}
                options={Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label, icon: r.icon }))}
              />
              <p className="text-xs text-zinc-500">{ROLES[role]?.hint}</p>
            </>
          )}
        </FormSection>
      )}
      {!user && role === "student" && courses.length > 0 && (
        <FormSection icon={BookOpen} title="Acesso aos cursos">
          <div className="grid gap-2 sm:grid-cols-2">
            {courses.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-700 transition-colors has-[:checked]:border-plum has-[:checked]:bg-plum/[0.04]">
                <input type="checkbox" name="courseId" value={c.id} className="h-4 w-4 accent-plum" />
                <span className="min-w-0 truncate">{c.title}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-zinc-500">Opcional: também pode dar acesso mais tarde, na página de cada curso.</p>
        </FormSection>
      )}
      {!user && (
        <FormSection icon={KeyRound} title="Acesso">
          <Field label="Palavra-passe inicial" hint="Deixe vazio para gerar uma automaticamente (mínimo 8 caracteres se a escrever).">
            <IconInput icon={KeyRound}>
              <input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Gerar automaticamente" className="field" />
            </IconInput>
          </Field>
          <ToggleRow
            name="sendWelcome"
            label="Enviar email de boas-vindas com os dados de acesso"
            description="Link para entrar, email e palavra-passe provisória. Precisa do Resend configurado."
            defaultChecked
          />
        </FormSection>
      )}
      <ModalFooter error={state && !state.ok ? state.error : undefined}>
        <button type="button" onClick={onDone} className="btn-ghost !px-4 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending && <Loader2 size={14} className="animate-spin" />} {user ? "Guardar" : "Criar conta"}
        </button>
      </ModalFooter>
    </form>
  );
}

type ContactHit = Awaited<ReturnType<typeof searchContactsForAccount>>[number];

/** Procura um contacto do CRM para trazer o nome, o email e o telefone. */
function ContactPicker({ selected, onPick, onClear }: { selected: AccountPrefill | null; onPick: (c: AccountPrefill) => void; onClear: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [searching, start] = useTransition();
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await searchContactsForAccount(term))), 250);
    return () => clearTimeout(t);
  }, [q]);
  const shown = q.trim().length < 2 ? [] : hits;

  if (selected) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-plum/25 bg-plum/[0.04] px-4 py-3">
        <Contact size={16} className="shrink-0 text-plum" />
        <p className="min-w-0 flex-1 text-sm text-zinc-700">
          Dados de <b className="text-zinc-900">{selected.name}</b>, dos contactos. A conta fica ligada à ficha.
        </p>
        <button type="button" onClick={onClear} className="rounded-full p-1 text-zinc-400 hover:bg-white hover:text-zinc-700" aria-label="Não usar este contacto">
          <X size={15} />
        </button>
      </div>
    );
  }
  return (
    <FormSection icon={Contact} title="Importar de um contacto">
      <div className="relative">
        <IconInput icon={Search} suffix={searching ? <Loader2 size={14} className="animate-spin" /> : undefined}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar lead ou contacto por nome, email ou telefone" className="field" />
        </IconInput>
        {shown.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(24,24,27,0.35)]">
            {shown.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={c.hasAccount || !c.email}
                  onClick={() => {
                    onPick({ contactId: c.id, name: c.name, email: c.email, phone: c.phone });
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum/10 text-[11px] font-bold text-plum">{initials(c.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{c.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{c.email ?? "sem email"}{c.phone ? ` · ${c.phone}` : ""}</span>
                  </span>
                  {c.hasAccount ? <span className="chip shrink-0 border-zinc-200 bg-zinc-100 text-zinc-500">Já tem conta</span> : !c.email ? <span className="chip shrink-0 border-zinc-200 bg-zinc-100 text-zinc-500">Sem email</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.trim().length >= 2 && !searching && hits.length === 0 && <p className="mt-2 text-xs text-zinc-500">Nenhum contacto encontrado.</p>}
      </div>
      <p className="text-xs text-zinc-500">Opcional: traz o nome, o email e o telefone, e liga a conta à ficha do contacto.</p>
    </FormSection>
  );
}

/** Confirmação depois de criar a conta: palavra-passe gerada (só aparece aqui) e estado do email. */
function AccountCreated({ result, email, onDone }: { result: TeamResult; email: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const welcome =
    result.welcome === "sent"
      ? { ok: true, text: `Email de boas-vindas enviado para ${email}.` }
      : result.welcome === "preview"
        ? { ok: false, text: "O email de boas-vindas não foi enviado: o Resend não está configurado. Envie os dados de acesso por outro canal." }
        : result.welcome === "failed"
          ? { ok: false, text: "O email de boas-vindas falhou. Envie os dados de acesso por outro canal." }
          : null;
  return (
    <div className="pb-6">
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
        <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <p>
          Conta de <b>{result.name}</b> criada. Entra com <b>{email}</b>.
        </p>
      </div>
      {result.password && (
        <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Palavra-passe provisória</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-zinc-100 px-3 py-2 font-mono text-base tracking-wide text-zinc-900">{result.password}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(result.password!);
                setCopied(true);
              }}
              className="btn-ghost !px-4 !py-2 !text-xs"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Só aparece agora. A pessoa pode trocá-la em Minha conta.</p>
        </div>
      )}
      {welcome && (
        <p className={cn("mt-4 flex items-start gap-2 text-xs font-medium", welcome.ok ? "text-emerald-700" : "text-amber-700")}>
          <Send size={13} className="mt-0.5 shrink-0" /> {welcome.text}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onDone} className="btn-primary !px-5 !py-2.5 !text-xs">
          Concluir
        </button>
      </div>
    </div>
  );
}

/** Etiqueta da ficha do contacto quando já há conta com o mesmo email. */
export function AccountChip({ role }: { role: string }) {
  return (
    <Link
      href="/admin/config?s=equipa#utilizadores"
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700"
      title="Já existe uma conta na plataforma com este email"
    >
      <GraduationCap size={14} /> {role === "student" ? "Já é estudante" : "Já tem conta"}
    </Link>
  );
}

/** Ficha do contacto: "Criar conta de estudante" com os dados do contacto já preenchidos. */
export function ConvertToStudentButton({
  contact,
  courses,
  account,
  lockRole,
}: {
  contact: AccountPrefill;
  courses: CourseOption[];
  lockRole?: boolean;
  /** Conta que já existe com o email do contacto (a janela continua aberta ao mostrar a palavra-passe). */
  account?: { role: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      {account ? (
        <AccountChip role={account.role} />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost !px-5 !py-2.5 !text-xs">
          <GraduationCap size={14} /> Converter em estudante
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Criar conta de estudante" description={`A partir do contacto ${contact.name}`} icon={GraduationCap}>
        {open && (
          <UserForm
            user={null}
            isMe={false}
            courses={courses}
            prefill={contact}
            defaultRole="student"
            lockRole={lockRole}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function PasswordForm({ user, onDone }: { user: TeamUser; onDone: () => void }) {
  const [state, action, pending] = useActionState<TeamResult | null, FormData>(setUserPassword.bind(null, user.id), null);
  if (state?.ok) {
    return (
      <div className="pb-6">
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Palavra-passe de {user.name} alterada.</p>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onDone} className="btn-primary !px-5 !py-2.5 !text-xs">
            Fechar
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={action}>
      <FormSection icon={KeyRound} title="Nova palavra-passe">
        <Field label="Nova palavra-passe" required hint="Mínimo 8 caracteres.">
          <IconInput icon={KeyRound}>
            <input name="password" type="password" minLength={8} required autoComplete="new-password" className="field" data-autofocus />
          </IconInput>
        </Field>
        <Field label="Repetir" required>
          <IconInput icon={KeyRound}>
            <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className="field" />
          </IconInput>
        </Field>
      </FormSection>
      <ModalFooter error={state && !state.ok ? state.error : undefined}>
        <button type="button" onClick={onDone} className="btn-ghost !px-4 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending && <Loader2 size={14} className="animate-spin" />} Guardar palavra-passe
        </button>
      </ModalFooter>
    </form>
  );
}

/* --------------------------------- TAGS ---------------------------------- */

export type TagRow = { id: number; name: string; color: string; count: number };

const TAG_COLORS = ["#800080", "#a855f7", "#6366f1", "#0ea5e9", "#14b8a6", "#25d366", "#eab308", "#f97316", "#ef4444", "#ec4899", "#71717a"];

export function TagManager({ tags, canManage }: { tags: TagRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const run = (fn: () => Promise<TeamResult>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Não foi possível guardar.");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <ul className="grid gap-2 md:grid-cols-2">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <input
              type="color"
              defaultValue={t.color}
              disabled={!canManage}
              onChange={(e) => {
                const c = e.target.value;
                run(() => updateTag(t.id, t.name, c));
              }}
              className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-white p-0.5 disabled:cursor-default"
              aria-label={`Cor de ${t.name}`}
            />
            <input
              defaultValue={t.name}
              readOnly={!canManage}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (canManage && v && v !== t.name) run(() => updateTag(t.id, v, t.color));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="field min-w-0 !border-transparent !bg-transparent !px-2 !py-1 font-semibold hover:!border-zinc-200 focus:!bg-white"
            />
            <Link href={`/admin/contactos?tag=${t.id}`} className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-plum">
              {num(t.count)} contacto{t.count === 1 ? "" : "s"}
            </Link>
            {canManage && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  confirm(`Apagar a tag “${t.name}”? ${t.count ? `Sai dos ${t.count} contacto(s); os contactos ficam.` : ""}`) &&
                  run(() => deleteTag(t.id))
                }
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Apagar ${t.name}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {tags.length === 0 && <p className="text-sm text-zinc-500">Sem tags criadas.</p>}
      </ul>
      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = name;
            setName("");
            run(() => createTag(v, color));
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="flex gap-1">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn("h-6 w-6 rounded-full border-2 transition-transform", color === c ? "scale-110 border-zinc-900" : "border-white")}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Tag size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color }} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova tag (ex: Lead Workshop Novembro)" className="field !pl-10" />
          </div>
          <button type="submit" disabled={pending || !name.trim()} className="btn-primary shrink-0 !px-4 !py-2.5 !text-xs disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
          </button>
        </form>
      )}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
