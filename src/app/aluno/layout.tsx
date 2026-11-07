import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, GraduationCap, LogOut } from "lucide-react";
import { AppBehaviors } from "@/components/app-behaviors";
import { logout } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Adicionada ao ecrã inicial, a área de estudante abre em ecrã inteiro como uma app
export const metadata: Metadata = {
  manifest: "/aluno.webmanifest",
  appleWebApp: { capable: true, title: "Marina Loyola", statusBarStyle: "default" },
  icons: { apple: "/img/app-icon-180.png" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default async function AlunoLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="aluno-root min-h-screen bg-zinc-50 text-zinc-800">
      <AppBehaviors />
      <header className="no-print sticky top-0 z-40 border-b border-zinc-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-5">
          <Link href="/aluno" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold italic text-zinc-950">
              Marina Loyola
            </span>
            <span className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-[0.28em] text-plum sm:flex">
              <GraduationCap size={13} /> Área de estudante
            </span>
          </Link>
          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-plum sm:flex"
            >
              <ExternalLink size={13} /> Ver site
            </Link>
            <Link href="/aluno/conta" title="Minha conta" className="flex items-center gap-2.5 rounded-full transition-opacity hover:opacity-80">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-plum text-[11px] font-bold text-white">
                {initials(user.name)}
              </span>
              <span className="hidden text-sm font-medium text-zinc-600 sm:block">
                {user.name.split(" ")[0]}
              </span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sair"
                className="tap flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-500 transition-colors hover:border-rose-500/40 hover:text-rose-700 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
              >
                <LogOut size={13} /> <span className="max-sm:hidden">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:py-10">{children}</main>
    </div>
  );
}
