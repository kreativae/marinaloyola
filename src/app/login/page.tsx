import Link from "next/link";
import { Lock, LogIn, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { login } from "@/lib/actions";
import { passkeyLoginEnabled } from "@/lib/actions-account";
import { PasskeyLogin } from "@/components/account-client";
import { Mascot } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso à plataforma Marina Loyola — administração e área de aluna.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sessao?: string }>;
}) {
  const { erro, sessao } = await searchParams;
  const expired = sessao === "expirada";
  const passkeys = await passkeyLoginEnabled();

  return (
    <section className="grain relative flex min-h-screen items-center justify-center bg-white px-5 text-zinc-950">
      <div className="glow-plum pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto block w-fit text-center">
          <span className="font-display text-3xl font-semibold italic">Marina Loyola</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">
            Plataforma
          </span>
        </Link>

        {expired && <Mascot mood="sleepy" className="mx-auto -mb-6 mt-4 h-40 w-44" />}

        <div className="mt-10 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 backdrop-blur lg:p-10">
          <h1 className="font-display text-2xl italic">{expired ? "A sua sessão terminou." : "Bem-vinda de volta."}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {expired
              ? "Por segurança, precisa de entrar outra vez para continuar onde estava."
              : "Entre com as suas credenciais para continuar."}
          </p>

          {erro === "bloqueado" && (
            <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              Demasiadas tentativas erradas. Por segurança, aguarde 15 minutos ou entre com Face ID.
            </p>
          )}
          {erro === "1" && (
            <p className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              Email ou password incorretos. Tente novamente.
            </p>
          )}

          <form action={login} className="mt-7 space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete={passkeys ? "username webauthn" : "email"}
                className="field"
                placeholder="voce@email.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="field"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              <LogIn size={16} />
              Entrar
            </button>
          </form>

          {passkeys && <PasskeyLogin />}

          {/* Só em desenvolvimento: no servidor as contas de exemplo não existem nem devem ser anunciadas */}
          {process.env.NODE_ENV !== "production" && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              <Lock size={12} /> Acesso de demonstração
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-zinc-500">
              <p>
                <span className="text-plum">Admin:</span> marina@marinaloyola.com · marina123
              </p>
              <p>
                <span className="text-plum">Aluna:</span> sofia@email.com · aluno123
              </p>
            </div>
          </div>
          )}
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
          <Sparkles size={13} className="text-plum" />
          Área de aluna e administração num só acesso.
        </p>
      </div>
    </section>
  );
}
