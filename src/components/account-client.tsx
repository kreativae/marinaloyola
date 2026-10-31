"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import { Check, KeyRound, Laptop, Loader2, Mail, Pencil, Phone, ScanFace, Smartphone, Trash2, User } from "lucide-react";
import { Field, FormSection, IconInput } from "@/components/form-kit";
import {
  changeMyPassword,
  deletePasskey,
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  renamePasskey,
  setPasskeyLogin,
  updateMyProfile,
  type AccountResult,
} from "@/lib/actions-account";
import { cn } from "@/lib/utils";

const HOME_TZ = "Europe/Lisbon";
const fmtWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-PT", { timeZone: HOME_TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Nunca usada";

/** Erros do navegador ao cancelar ou falhar o Face ID, em português. */
function webauthnError(e: unknown) {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return null; // cancelado pela pessoa
  if (name === "InvalidStateError") return "Este aparelho já está ativado nesta conta.";
  if (name === "SecurityError") return "O Face ID só funciona no endereço seguro da plataforma (https).";
  return e instanceof Error ? e.message : "Não foi possível usar o Face ID.";
}

/* --------------------------------- LOGIN --------------------------------- */

/**
 * Botão "Entrar com Face ID" e sugestão automática no campo de email
 * (o iPhone/Mac mostram a chave guardada logo ao tocar no campo).
 */
export function PasskeyLogin() {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (response: Parameters<typeof passkeyLoginVerify>[0]) => {
    setPending(true);
    const r = await passkeyLoginVerify(response);
    if (r.ok) {
      router.replace(r.to);
      router.refresh();
    } else {
      setError(r.error);
      setPending(false);
    }
  };

  useEffect(() => {
    let alive = true;
    if (!browserSupportsWebAuthn()) return;
    queueMicrotask(() => alive && setSupported(true));
    (async () => {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      const opts = await passkeyLoginOptions();
      if (!alive || !opts.ok) return;
      try {
        const response = await startAuthentication({ optionsJSON: opts.options, useBrowserAutofill: true });
        if (alive) await finish(response);
      } catch {
        /* sugestão ignorada ou substituída pelo botão */
      }
    })();
    return () => {
      alive = false;
      WebAuthnAbortService.cancelCeremony();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  const click = async () => {
    setError(null);
    setPending(true);
    try {
      const opts = await passkeyLoginOptions();
      if (!opts.ok) {
        setError(opts.error);
        setPending(false);
        return;
      }
      const response = await startAuthentication({ optionsJSON: opts.options });
      await finish(response);
    } catch (e) {
      setError(webauthnError(e));
      setPending(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" /> ou <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <button
        type="button"
        onClick={click}
        disabled={pending}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full border border-zinc-300 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-plum/40 hover:text-plum disabled:opacity-60"
      >
        {pending ? <Loader2 size={18} className="animate-spin" /> : <ScanFace size={18} />}
        Entrar com Face ID
      </button>
      <p className="mt-2 text-center text-[11px] text-zinc-500">Também funciona com Touch ID, impressão digital ou Windows Hello.</p>
      {error && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

/* ------------------------------ MINHA CONTA ------------------------------ */

function Saved({ state, text }: { state: AccountResult | null; text: string }) {
  if (!state) return null;
  return state.ok ? (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
      <Check size={14} /> {text}
    </p>
  ) : (
    <p className="text-xs font-semibold text-rose-600">{state.error}</p>
  );
}

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [state, action, pending] = useActionState(updateMyProfile, null);
  return (
    <form action={action}>
      <FormSection icon={User} title="Dados pessoais">
        <Field label="Nome" required>
          <IconInput icon={User}>
            <input name="name" defaultValue={name} required autoComplete="name" className="field" />
          </IconInput>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required hint="É o email com que entra na plataforma.">
            <IconInput icon={Mail}>
              <input name="email" type="email" defaultValue={email} required autoComplete="email" className="field" />
            </IconInput>
          </Field>
          <Field label="Telefone" hint="Com indicativo, ex.: +351 912 345 678.">
            <IconInput icon={Phone}>
              <input name="phone" type="tel" defaultValue={phone} autoComplete="tel" className="field" placeholder="+351 …" />
            </IconInput>
          </Field>
        </div>
      </FormSection>
      <div className="mt-5 flex items-center justify-end gap-4">
        <Saved state={state} text="Dados guardados." />
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending && <Loader2 size={14} className="animate-spin" />} Guardar dados
        </button>
      </div>
    </form>
  );
}

export function PasswordChangeForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: AccountResult | null, fd: FormData) => {
    const r = await changeMyPassword(prev, fd);
    if (r.ok) form.current?.reset();
    return r;
  }, null);
  return (
    <form ref={form} action={action}>
      <FormSection icon={KeyRound} title="Palavra-passe">
        <Field label="Palavra-passe atual" required>
          <IconInput icon={KeyRound}>
            <input name="current" type="password" required autoComplete="current-password" className="field" />
          </IconInput>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova palavra-passe" required hint="Mínimo 8 caracteres.">
            <IconInput icon={KeyRound}>
              <input name="password" type="password" minLength={8} required autoComplete="new-password" className="field" />
            </IconInput>
          </Field>
          <Field label="Repetir" required>
            <IconInput icon={KeyRound}>
              <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className="field" />
            </IconInput>
          </Field>
        </div>
      </FormSection>
      <div className="mt-5 flex items-center justify-end gap-4">
        <Saved state={state} text="Palavra-passe alterada." />
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending && <Loader2 size={14} className="animate-spin" />} Alterar palavra-passe
        </button>
      </div>
    </form>
  );
}

export type PasskeyRow = {
  id: number;
  name: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  owner?: string;
};


function PasskeyItem({ k, showOwner, readOnly }: { k: PasskeyRow; showOwner?: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const mobile = /iPhone|iPad|Android/.test(k.name);

  const run = (fn: () => Promise<AccountResult>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro.");
      else {
        setError(null);
        setEditing(false);
        router.refresh();
      }
    });

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plum/[0.08] text-plum">
        {mobile ? <Smartphone size={18} /> : <Laptop size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={k.name}
            maxLength={60}
            onBlur={(e) => (e.target.value.trim() && e.target.value !== k.name ? run(() => renamePasskey(k.id, e.target.value)) : setEditing(false))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="field !py-1.5 text-sm"
          />
        ) : (
          <p className="truncate text-sm font-semibold text-zinc-900">
            {showOwner && k.owner && <span className="text-plum">{k.owner} · </span>}
            {k.name}
          </p>
        )}
        <p className="truncate text-[11px] text-zinc-500">
          Ativada {fmtWhen(k.createdAt)} · Último uso: {k.lastUsedAt ? fmtWhen(k.lastUsedAt) : "nunca"}
          {k.backedUp && " · sincronizada no iCloud/Google"}
        </p>
        {error && <p className="mt-1 text-[11px] font-semibold text-rose-600">{error}</p>}
      </div>
      {readOnly ? null : pending ? (
        <Loader2 size={16} className="animate-spin text-zinc-400" />
      ) : (
        <>
          <button type="button" onClick={() => setEditing(true)} title="Mudar nome" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
            <Pencil size={15} />
          </button>
          <button
            type="button"
            title="Remover"
            onClick={() => confirm(`Remover "${k.name}"? Esse aparelho deixa de poder entrar com Face ID.`) && run(() => deletePasskey(k.id))}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </li>
  );
}

export function PasskeyManager({ keys, enabled }: { keys: PasskeyRow[]; enabled: boolean }) {
  const router = useRouter();
  const [support, setSupport] = useState<"checking" | "platform" | "other" | "none">("checking");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<AccountResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = !browserSupportsWebAuthn() ? "none" : (await platformAuthenticatorIsAvailable()) ? "platform" : "other";
      if (alive) setSupport(s);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const activate = async () => {
    setMsg(null);
    setPending(true);
    try {
      const opts = await passkeyRegisterOptions();
      if (!opts.ok) throw new Error(opts.error);
      const response = await startRegistration({ optionsJSON: opts.options });
      const r = await passkeyRegisterVerify(response);
      setMsg(r.ok ? { ok: true } : r);
      if (r.ok) router.refresh();
    } catch (e) {
      const text = webauthnError(e);
      if (text) setMsg({ ok: false, error: text });
    }
    setPending(false);
  };

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-plum/[0.07] to-transparent p-5 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-plum text-white shadow-[0_10px_24px_-10px_rgb(128_0_128/0.7)]">
          <ScanFace size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {keys.length ? `Face ID ativo em ${keys.length} aparelho${keys.length > 1 ? "s" : ""}` : "Entre sem palavra-passe"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            Ative em cada aparelho que usa (iPhone, Mac, Android, Windows). Depois, no ecrã de entrada, basta tocar em
            “Entrar com Face ID”. Os dados biométricos nunca saem do aparelho.
          </p>
        </div>
        <button
          type="button"
          onClick={activate}
          disabled={pending || support === "none" || !enabled}
          className="btn-primary shrink-0 !px-5 !py-2.5 !text-xs disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <ScanFace size={15} />} Ativar neste aparelho
        </button>
      </div>

      {!enabled && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          A entrada com Face ID está desativada pela administração em Configurações.
        </p>
      )}
      {support === "none" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">Este navegador não suporta Face ID nem chaves de acesso.</p>
      )}
      {support === "other" && (
        <p className="mt-3 text-[11px] text-zinc-500">
          Este computador não tem leitor biométrico: pode usar o telemóvel (código QR) ou uma chave de segurança física.
        </p>
      )}
      {msg && (
        <p className={cn("mt-3 text-xs font-semibold", msg.ok ? "text-emerald-700" : "text-rose-600")}>
          {msg.ok ? "Face ID ativado neste aparelho." : msg.error}
        </p>
      )}

      {keys.length > 0 && (
        <ul className="mt-5 space-y-2">
          {keys.map((k) => (
            <PasskeyItem key={k.id} k={k} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------- CONFIGURAÇÕES ----------------------------- */

export function PasskeyAdmin({ keys, enabled, canManage }: { keys: PasskeyRow[]; enabled: boolean; canManage: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  return (
    <div>
      <label className={cn("flex items-center gap-3 rounded-2xl border border-line px-4 py-3", canManage && "cursor-pointer hover:bg-zinc-50/60")}>
        <input
          type="checkbox"
          checked={on}
          disabled={!canManage || pending}
          onChange={(e) => {
            const v = e.target.checked;
            setOn(v);
            start(async () => {
              const r = await setPasskeyLogin(v);
              if (!r.ok) setOn(!v);
              router.refresh();
            });
          }}
          className="peer sr-only"
        />
        <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-plum peer-checked:after:translate-x-4" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-800">Permitir entrar com Face ID</span>
          <span className="block text-xs text-zinc-500">
            Equipa e alunas podem ativar o Face ID / Touch ID em “Minha conta”. Desligar bloqueia de imediato a entrada por Face ID.
          </span>
        </span>
        {pending && <Loader2 size={15} className="animate-spin text-zinc-400" />}
      </label>

      {keys.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">Ainda ninguém ativou o Face ID.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {keys.map((k) => (
            <PasskeyItem key={k.id} k={k} showOwner readOnly={!canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}
