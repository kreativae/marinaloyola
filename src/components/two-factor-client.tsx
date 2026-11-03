"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { Field, IconInput } from "@/components/form-kit";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
  type TwoFactorResult,
} from "@/lib/actions-2fa";
import { cn } from "@/lib/utils";

/* --------------------------------- LOGIN --------------------------------- */

/** Campo do código: 6 dígitos da app (envia sozinho ao completar) ou um código de recuperação. */
export function TwoFactorCodeInput() {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Código</label>
      <input
        name="code"
        required
        autoFocus
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        placeholder="123 456"
        className="field text-center font-mono !text-2xl tracking-[0.3em]"
        onChange={(e) => {
          const digits = e.target.value.replace(/\s/g, "");
          if (/^\d{6}$/.test(digits)) e.target.form?.requestSubmit();
        }}
      />
    </div>
  );
}

/* ------------------------------- MINHA CONTA ------------------------------ */

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Marina Loyola — códigos de recuperação\nCada código só serve uma vez.\n\n${codes.join("\n")}\n`;
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-5">
      <p className="text-sm font-semibold text-zinc-900">Guarde estes códigos de recuperação</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        Servem para entrar se perder ou trocar de telemóvel. Cada um só funciona uma vez e não voltam a ser mostrados:
        guarde-os num gestor de palavras-passe ou imprima-os.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm text-zinc-900 sm:grid-cols-3 2xl:grid-cols-5">
        {codes.map((c) => (
          <li key={c} className="whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-center shadow-[0_1px_1px_rgb(24_24_27/0.04)]">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
          className="btn-ghost !px-4 !py-2 !text-xs"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiados" : "Copiar"}
        </button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
          download="marina-loyola-codigos-recuperacao.txt"
          className="btn-ghost !px-4 !py-2 !text-xs"
        >
          <Download size={13} /> Descarregar
        </a>
        <button type="button" onClick={onDone} className="btn-primary ml-auto !px-5 !py-2 !text-xs">
          <Check size={13} /> Já guardei
        </button>
      </div>
    </div>
  );
}

function PasswordAction({
  action,
  label,
  icon: Icon,
  danger,
  onResult,
}: {
  action: (prev: TwoFactorResult | null, fd: FormData) => Promise<TwoFactorResult>;
  label: string;
  icon: typeof KeyRound;
  danger?: boolean;
  onResult: (r: TwoFactorResult) => void;
}) {
  const [state, run, pending] = useActionState(async (prev: TwoFactorResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) onResult(r);
    return r;
  }, null);
  return (
    <form action={run} className="space-y-3">
      <Field label="Confirme com a sua palavra-passe">
        <IconInput icon={KeyRound}>
          <input name="password" type="password" required autoComplete="current-password" className="field" />
        </IconInput>
      </Field>
      {state && !state.ok && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          danger
            ? "inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
            : "btn-primary !px-5 !py-2.5 !text-xs",
          "disabled:opacity-60"
        )}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {label}
      </button>
    </form>
  );
}

export function TwoFactorManager({ enabledAt, recoveryLeft }: { enabledAt: string | null; recoveryLeft: number }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [panel, setPanel] = useState<"codes" | "off" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setError(null);
      const r = await startTwoFactorSetup();
      if (r.ok) setSetup({ qr: r.qr, secret: r.secret });
      else setError(r.error);
    });

  const confirm = () =>
    start(async () => {
      setError(null);
      const r = await confirmTwoFactorSetup(code);
      if (r.ok && r.codes) {
        setSetup(null);
        setCode("");
        setCodes(r.codes);
      } else setError(r.error ?? "Não foi possível ativar.");
    });

  const finish = () => {
    setCodes(null);
    router.refresh();
  };

  if (codes) return <RecoveryCodes codes={codes} onDone={finish} />;

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-plum/[0.07] to-transparent p-5 sm:flex-row sm:items-center">
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white",
            enabledAt ? "bg-emerald-600 shadow-[0_10px_24px_-10px_rgb(5_150_105/0.7)]" : "bg-plum shadow-[0_10px_24px_-10px_rgb(128_0_128/0.7)]"
          )}
        >
          <ShieldCheck size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {enabledAt
              ? `Ativa desde ${new Date(enabledAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}`
              : "Proteja a conta mesmo que a palavra-passe seja descoberta"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            {enabledAt
              ? `Ao entrar com palavra-passe é pedido o código da app autenticadora. Restam ${recoveryLeft} código${recoveryLeft === 1 ? "" : "s"} de recuperação.`
              : "Depois da palavra-passe, é pedido um código de 6 dígitos da app autenticadora do telemóvel (Google Authenticator, Microsoft Authenticator, 1Password…). A entrada com Face ID já conta como dois passos."}
          </p>
        </div>
        {!enabledAt && !setup && (
          <button type="button" onClick={begin} disabled={pending} className="btn-primary shrink-0 !px-5 !py-2.5 !text-xs disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={15} />} Ativar
          </button>
        )}
      </div>

      {enabledAt && recoveryLeft <= 2 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          Restam poucos códigos de recuperação. Gere novos para não ficar sem forma de entrar se perder o telemóvel.
        </p>
      )}

      {setup && (
        <div className="mt-5 grid gap-5 rounded-2xl border border-line p-5 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div
            className="mx-auto w-44 overflow-hidden rounded-xl border border-line bg-white p-2 sm:mx-0 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: setup.qr }}
          />
          <div className="min-w-0 space-y-3">
            <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-600">
              <li>Abra a app autenticadora no telemóvel e escolha adicionar conta.</li>
              <li>Leia este código QR com a câmara. Se não conseguir, escreva a chave:</li>
            </ol>
            <p className="break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-[13px] tracking-wide text-zinc-800">{setup.secret}</p>
            <p className="text-xs text-zinc-600">3. Escreva o código de 6 dígitos que aparece na app:</p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123456"
                className="field !w-36 text-center font-mono !text-lg tracking-[0.25em]"
              />
              <button type="submit" disabled={pending || code.replace(/\D/g, "").length !== 6} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar e ativar
              </button>
              <button type="button" onClick={() => setSetup(null)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}

      {enabledAt && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPanel(panel === "codes" ? null : "codes")}
              className={cn("btn-ghost !px-4 !py-2 !text-xs", panel === "codes" && "!border-plum !text-plum")}
            >
              <RefreshCw size={13} /> Gerar novos códigos de recuperação
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "off" ? null : "off")}
              className={cn("btn-ghost !px-4 !py-2 !text-xs hover:!text-rose-600", panel === "off" && "!border-rose-300 !text-rose-600")}
            >
              <ShieldOff size={13} /> Desativar
            </button>
          </div>
          {panel === "codes" && (
            <div className="max-w-sm">
              <p className="mb-3 text-xs text-zinc-500">Os códigos antigos deixam de funcionar.</p>
              <PasswordAction action={regenerateRecoveryCodes} label="Gerar códigos" icon={RefreshCw} onResult={(r) => r.codes && setCodes(r.codes)} />
            </div>
          )}
          {panel === "off" && (
            <div className="max-w-sm">
              <p className="mb-3 text-xs text-zinc-500">A conta volta a ficar protegida só pela palavra-passe.</p>
              <PasswordAction
                action={disableTwoFactor}
                label="Desativar verificação"
                icon={ShieldOff}
                danger
                onResult={() => {
                  setPanel(null);
                  router.refresh();
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
