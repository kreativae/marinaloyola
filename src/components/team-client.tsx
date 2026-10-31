"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, KeyRound, Loader2, Mail, Pencil, Plus, Search, ShieldCheck, Tag, Trash2, User, UserPlus, Users } from "lucide-react";
import { Field, FormSection, IconInput, Modal, ModalFooter, PillGroup } from "@/components/form-kit";
import { createTag, deleteTag, deleteUser, saveUser, setUserPassword, updateTag, type TeamResult } from "@/lib/actions-team";
import { cn, num } from "@/lib/utils";

/* ------------------------------ UTILIZADORES ----------------------------- */

export type TeamUser = { id: number; name: string; email: string; role: string; createdAt: string };

const ROLES: Record<string, { label: string; className: string; icon: typeof Users; hint: string }> = {
  admin: { label: "Super Admin", className: "bg-plum/20 text-plum border-plum/40", icon: ShieldCheck, hint: "Acesso total, incluindo contas e configurações." },
  staff: { label: "Equipa", className: "bg-sky-500/10 text-sky-700 border-sky-500/30", icon: Users, hint: "Usa o backoffice, sem gerir contas." },
  student: { label: "Aluna", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: GraduationCap, hint: "Só a área de aluna e os cursos em que está inscrita." },
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function UserManager({ users, meId, canManage }: { users: TeamUser[]; meId: number; canManage: boolean }) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome ou email" className="field !pl-10" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "admin", "staff", "student"] as const).map((r) => (
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

      <div className="table-shell">
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
                    <span className={`chip ${r?.className ?? ""}`}>
                      <Icon size={11} /> {r?.label ?? u.role}
                    </span>
                  </td>
                  <td className="admin-td hidden text-xs text-zinc-500 md:table-cell">{new Date(u.createdAt).toLocaleDateString("pt-PT")}</td>
                  {canManage && (
                    <td className="admin-td">
                      <div className="flex justify-end gap-0.5">
                        <button type="button" onClick={() => setEditing(u)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white hover:text-plum" aria-label={`Editar ${u.name}`} title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => setPwFor(u)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white hover:text-plum" aria-label={`Trocar a palavra-passe de ${u.name}`} title="Trocar palavra-passe">
                          <KeyRound size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={pending || u.id === meId}
                          onClick={() => remove(u)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30"
                          aria-label={`Apagar ${u.name}`}
                          title={u.id === meId ? "Não pode apagar a sua própria conta" : "Apagar"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
      {!canManage && <p className="text-[11px] text-zinc-500">Só a Super Admin pode criar, editar ou apagar contas.</p>}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo utilizador" : "Editar utilizador"}
        description={editing === "new" ? "Crie uma conta para a equipa ou para uma aluna." : editing ? editing.email : undefined}
        icon={editing === "new" ? UserPlus : Pencil}
      >
        {editing !== null && (
          <UserForm
            key={editing === "new" ? "new" : editing.id}
            user={editing === "new" ? null : editing}
            isMe={editing !== "new" && editing.id === meId}
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

function UserForm({ user, isMe, onDone }: { user: TeamUser | null; isMe: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState<TeamResult | null, FormData>(saveUser.bind(null, user?.id ?? null), null);
  const [role, setRole] = useState(user?.role ?? "staff");
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      <FormSection icon={User} title="Dados">
        <Field label="Nome" required>
          <IconInput icon={User}>
            <input name="name" required defaultValue={user?.name} className="field" data-autofocus />
          </IconInput>
        </Field>
        <Field label="Email" required hint="É com este email que a pessoa entra na plataforma.">
          <IconInput icon={Mail}>
            <input name="email" type="email" required defaultValue={user?.email} className="field" />
          </IconInput>
        </Field>
      </FormSection>
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
      {!user && (
        <FormSection icon={KeyRound} title="Palavra-passe">
          <Field label="Palavra-passe inicial" required hint="Mínimo 8 caracteres. Envie-a à pessoa por um canal seguro.">
            <IconInput icon={KeyRound}>
              <input name="password" type="password" minLength={8} required autoComplete="new-password" className="field" />
            </IconInput>
          </Field>
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
