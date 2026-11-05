import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { readPendingLogin } from "@/lib/auth";
import { verifyTwoFactorLogin } from "@/lib/actions-2fa";
import { TwoFactorCodeInput } from "@/components/two-factor-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificação em dois passos" };

export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (!(await readPendingLogin())) redirect("/login?erro=expirado");
  const { erro } = await searchParams;

  return (
    <section className="grain relative flex min-h-screen items-center justify-center bg-white px-5 text-zinc-950">
      <div className="glow-plum pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto block w-fit text-center">
          <span className="font-display text-3xl font-semibold italic">Marina Loyola</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">Plataforma</span>
        </Link>

        <div className="mt-10 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 backdrop-blur lg:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-plum text-white shadow-[0_10px_24px_-10px_rgb(128_0_128/0.8)]">
            <ShieldCheck size={22} />
          </span>
          <h1 className="mt-5 font-display text-2xl italic">Confirme que é você.</h1>
          <p className="mt-1 text-sm text-zinc-500">Abra a app autenticadora no telemóvel e escreva o código de 6 dígitos da Marina Loyola.</p>

          {erro === "1" && (
            <p className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              Código incorreto ou já usado. Escreva o código que aparece agora na app.
            </p>
          )}

          <form action={verifyTwoFactorLogin} className="mt-7 space-y-5">
            <TwoFactorCodeInput />
            <button type="submit" className="btn-primary w-full">
              <ShieldCheck size={16} />
              Verificar e entrar
            </button>
          </form>

          <details className="mt-6 text-xs text-zinc-500">
            <summary className="cursor-pointer font-semibold text-zinc-600 hover:text-plum">Não tem o telemóvel consigo?</summary>
            <p className="mt-2 leading-relaxed">
              Escreva no campo acima um dos códigos de recuperação que guardou quando ativou a verificação (formato
              <span className="font-mono"> abcde-12345</span>). Cada código só serve uma vez. Sem eles, peça ao suporte da plataforma
              para desligar a verificação na sua conta.
            </p>
          </details>
        </div>

        <Link href="/login" className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-500 hover:text-plum">
          <ArrowLeft size={13} /> Voltar ao início de sessão
        </Link>
      </div>
    </section>
  );
}
