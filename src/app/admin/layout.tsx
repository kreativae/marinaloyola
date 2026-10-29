import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { logout } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { initials } from "@/lib/utils";
import { SidebarNav } from "@/components/admin-client";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-200 bg-white lg:flex">
        <Link href="/admin" className="border-b border-zinc-200 px-6 py-6">
          <span className="font-display text-xl font-semibold italic text-zinc-950">
            Marina Loyola
          </span>
          <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.34em] text-plum">
            Painel de Gestão
          </span>
        </Link>
        <SidebarNav />
        <div className="border-t border-zinc-200 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum text-xs font-bold text-white">
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-950">{user.name}</p>
              <p className="truncate text-[11px] text-zinc-500">
                {user.role === "admin" ? "Super Admin" : "Equipa"}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sair"
                className="text-zinc-500 transition-colors hover:text-rose-600"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
          <Link
            href="/"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:border-plum/50 hover:text-plum"
          >
            <ExternalLink size={12} /> Ver site
          </Link>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
          <Link href="/admin" className="font-display text-lg font-semibold italic text-zinc-950">
            Marina Loyola
          </Link>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-1.5 text-xs text-zinc-500">
              <LogOut size={14} /> Sair
            </button>
          </form>
        </header>
        <div className="overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2">
          <SidebarNav horizontal />
        </div>
      </div>

      <div className="lg:pl-64">
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
