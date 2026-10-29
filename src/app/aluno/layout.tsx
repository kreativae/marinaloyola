import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, GraduationCap, LogOut } from "lucide-react";
import { logout } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlunoLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/aluno" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold italic text-zinc-950">
              Marina Loyola
            </span>
            <span className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-[0.28em] text-plum sm:flex">
              <GraduationCap size={13} /> Área de aluna
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-plum sm:flex"
            >
              <ExternalLink size={13} /> Ver site
            </Link>
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-plum text-[11px] font-bold text-white">
                {initials(user.name)}
              </span>
              <span className="hidden text-sm font-medium text-zinc-600 sm:block">
                {user.name.split(" ")[0]}
              </span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-rose-500/40 hover:text-rose-700"
              >
                <LogOut size={13} /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
