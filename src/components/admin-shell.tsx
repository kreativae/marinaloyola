"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  CalendarPlus,
  ChevronsLeft,
  ClipboardList,
  CornerDownLeft,
  ExternalLink,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Layers,
  Loader2,
  LogOut,
  Megaphone,
  MessageCircle,
  NotebookPen,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
  UserRound,
} from "lucide-react";
import { AppBehaviors } from "@/components/app-behaviors";
import { BottomSheet } from "@/components/sheet";
import { logout } from "@/lib/actions";
import { quickSearchContacts } from "@/lib/actions-contacts";
import { flag, fmtTime } from "@/lib/timezones";
import { cn, initials } from "@/lib/utils";

/* ------------------------------ NAVEGAÇÃO ------------------------------- */

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "whatsapp" | "today" | "forms" };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Visão geral", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Relacionamento",
    items: [
      { href: "/admin/contactos", label: "Contactos", icon: Users },
      { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, badge: "whatsapp" },
      { href: "/admin/pipeline", label: "Pipeline", icon: Layers },
      { href: "/admin/notas", label: "Notas", icon: NotebookPen },
    ],
  },
  {
    group: "Operação",
    items: [
      { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, badge: "today" },
      { href: "/admin/cursos", label: "Cursos & LMS", icon: GraduationCap },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/links", label: "Link na bio", icon: Link2 },
      { href: "/admin/site", label: "Site", icon: Globe },
      { href: "/admin/formularios", label: "Formulários", icon: ClipboardList, badge: "forms" },
      { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
    ],
  },
  { group: "Sistema", items: [{ href: "/admin/config", label: "Configurações", icon: Settings }] },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

// As fichas individuais continuam em /admin/crm/[id] e pertencem a "Contactos"
function isActive(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/contactos") return pathname.startsWith(href) || pathname.startsWith("/admin/crm");
  return pathname.startsWith(href);
}

// Separadores da barra inferior do telemóvel; o resto fica em "Mais"
const TABS: NavItem[] = [
  { href: "/admin", label: "Início", icon: LayoutDashboard },
  { href: "/admin/contactos", label: "Contactos", icon: Users },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, badge: "whatsapp" },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, badge: "today" },
];
const MORE_ITEMS = ALL_ITEMS.filter((i) => !TABS.some((t) => t.href === i.href));

const CREATE_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/contactos?novo=1", label: "Novo contacto", icon: UserPlus },
  { href: "/admin/agenda?view=calendario&modo=semana&evento=novo", label: "Novo evento", icon: CalendarPlus },
  { href: "/admin/notas?nova=1", label: "Nova nota", icon: NotebookPen },
  { href: "/admin/financeiro?novo=1", label: "Registar recebimento", icon: Wallet },
  { href: "/admin/financeiro?despesa=1", label: "Registar despesa", icon: Wallet },
  { href: "/admin/marketing?novo=1", label: "Novo conteúdo", icon: Megaphone },
  { href: "/admin/agenda?view=calendario&modo=semana", label: "Agenda da semana", icon: CalendarDays },
];

const roleLabel = (role: string) => (role === "admin" ? "Super Admin" : role === "manager" ? "Admin" : "Equipa");

export type ShellUser = { name: string; role: string };
export type ShellCounts = { whatsapp: number; today: number; forms: number };

/* -------------------------------- SHELL --------------------------------- */

export function AdminShell({
  user,
  counts,
  initialCollapsed,
  children,
}: {
  user: ShellUser;
  counts: ShellCounts;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
    setCreateOpen(false);
  }
  useKeyboardViewport();

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `ml_sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  // ⌘K / Ctrl+K e "/" abrem a paleta de comandos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="admin-root min-h-screen bg-canvas text-zinc-800">
      {/* Barra lateral (desktop) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-white/80 backdrop-blur-xl transition-[width] duration-500 ease-[var(--ease-out-soft)] lg:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <SidebarContent user={user} counts={counts} collapsed={collapsed} onToggle={toggle} />
      </aside>

      <div className={cn("transition-[padding] duration-500 ease-[var(--ease-out-soft)]", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <Topbar onCreate={() => setCreateOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="mx-auto max-w-[112rem] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8 min-[1800px]:px-14">
          {children}
        </main>
      </div>

      <AppBehaviors />
      <MobileTabBar counts={counts} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} counts={counts} />
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Criar">
        <div className="grid grid-cols-2 gap-2 pt-2">
          {CREATE_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              onClick={() => setCreateOpen(false)}
              className="tap flex items-center gap-2.5 rounded-2xl bg-zinc-50 px-3 py-3.5 text-[13px] font-semibold leading-tight text-zinc-800"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-plum/[0.08] text-plum">
                <a.icon size={15} />
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </BottomSheet>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} superAdmin={user.role === "admin"} />
    </div>
  );
}

/**
 * O teclado do iPhone tapa a página sem a encolher. Estas variáveis dizem à interface
 * quanto ecrã sobra, para que janelas e conversas fiquem sempre acima do teclado.
 */
function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvt", `${vv.offsetTop}px`);
      root.style.setProperty("--kb", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      ["--vvh", "--vvt", "--kb"].forEach((k) => root.style.removeProperty(k));
    };
  }, []);
}

/* -------------------------- NAVEGAÇÃO NO TELEMÓVEL ----------------------- */

function CountDot({ n, green }: { n: number; green?: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums text-white ring-2 ring-white",
        green ? "bg-emerald-500" : "bg-plum"
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function MobileTabBar({ counts, onMore, moreOpen }: { counts: ShellCounts; onMore: () => void; moreOpen: boolean }) {
  const realPath = usePathname();
  // O separador tocado acende logo, antes de a página chegar
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const pathname = clicked && clicked.from === realPath ? clicked.href : realPath;
  const activeTab = TABS.findIndex((t) => isActive(t.href, pathname));
  const index = moreOpen || activeTab < 0 ? TABS.length : activeTab;

  // Com o teclado aberto a barra sai do caminho
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && t.matches("textarea, select, [contenteditable], input:not([type=checkbox]):not([type=radio]):not([type=file])");
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = (e: FocusEvent) => isField(e.target) && setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  const cell = "tap relative z-10 flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors";
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-transform duration-300 ease-[var(--ease-out-soft)] lg:hidden",
        typing && "translate-y-full"
      )}
    >
      <div className="relative mx-auto flex max-w-lg px-1.5">
        <span
          aria-hidden
          className="absolute top-1.5 h-[30px] rounded-full bg-plum/[0.09] transition-transform duration-[400ms] ease-[var(--ease-out-soft)]"
          style={{ width: "calc((100% - 0.75rem) / 5 - 1rem)", left: "calc(0.375rem + 0.5rem)", transform: `translateX(calc(${index} * (100% + 1rem)))` }}
        />
        {TABS.map((t, i) => {
          const on = i === index;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              onClick={(e) => {
                // Tocar no separador em que já se está volta ao topo, como numa app
                if (t.href === realPath) {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else setClicked({ href: t.href, from: realPath });
              }}
              className={cn(cell, on ? "text-plum" : "text-zinc-500")}
            >
              <span className="relative">
                <t.icon size={20} strokeWidth={on ? 2.2 : 1.8} />
                {t.badge && <CountDot n={counts[t.badge]} green={t.badge === "whatsapp"} />}
              </span>
              {t.label}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} aria-expanded={moreOpen} className={cn(cell, index === TABS.length ? "text-plum" : "text-zinc-500")}>
          <span className="relative">
            <MoreHorizontal size={20} strokeWidth={index === TABS.length ? 2.2 : 1.8} />
            <CountDot n={counts.forms} />
          </span>
          Mais
        </button>
      </div>
    </nav>
  );
}

function MoreSheet({ open, onClose, user, counts }: { open: boolean; onClose: () => void; user: ShellUser; counts: ShellCounts }) {
  const pathname = usePathname();
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Link href="/admin/conta" onClick={onClose} className="tap mb-3 mt-2 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-sm font-bold text-white">{initials(user.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-zinc-950">{user.name}</span>
          <span className="block truncate text-xs text-zinc-500">{roleLabel(user.role)} · Minha conta</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-zinc-400" />
      </Link>

      <div className="grid grid-cols-3 gap-2">
        {MORE_ITEMS.map((item) => {
          const on = isActive(item.href, pathname);
          const badge = item.badge ? counts[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "tap flex flex-col items-center gap-2 rounded-2xl px-1 py-3.5 text-center text-xs font-semibold",
                on ? "bg-plum/[0.08] text-plum" : "bg-zinc-50 text-zinc-700"
              )}
            >
              <span className="relative">
                <item.icon size={21} strokeWidth={1.9} className={on ? "text-plum" : "text-zinc-500"} />
                <CountDot n={badge} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <Link href="/" target="_blank" onClick={onClose} className="tap flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line py-3 text-[13px] font-semibold text-zinc-600">
          <ExternalLink size={15} /> Ver site
        </Link>
        <form action={logout} className="flex-1">
          <button type="submit" className="tap flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-[13px] font-semibold text-rose-600">
            <LogOut size={15} /> Sair
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}

/* ---------------------------- BARRA LATERAL ----------------------------- */

function SidebarContent({
  user,
  counts,
  collapsed,
  onToggle,
}: {
  user: ShellUser;
  counts: ShellCounts;
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const realPath = usePathname();
  // Destaque optimista: o item clicado fica activo de imediato, antes de a página chegar
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const pathname = clicked && clicked.from === realPath ? clicked.href : realPath;
  const navRef = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const activeHref = ALL_ITEMS.find((i) => isActive(i.href, pathname))?.href;

  // Indicador que desliza até ao item activo
  useLayoutEffect(() => {
    const nav = navRef.current;
    const ind = indicator.current;
    if (!nav || !ind) return;
    const el = nav.querySelector<HTMLElement>(`[data-href="${activeHref}"]`);
    if (!el) {
      ind.style.opacity = "0";
      return;
    }
    ind.style.opacity = "1";
    ind.style.transform = `translateY(${el.offsetTop}px)`;
    ind.style.height = `${el.offsetHeight}px`;
  }, [activeHref, collapsed]);

  return (
    <>
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-line", collapsed ? "justify-center px-0" : "px-5")}>
        <Link href="/admin" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2a0a2e] font-display text-sm italic text-white shadow-[0_6px_16px_-6px_rgb(42_10_46/0.6)]">
            ML
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate font-display text-[17px] font-semibold italic leading-tight text-zinc-950">
                Marina Loyola
              </span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.3em] text-plum">Backoffice</span>
            </span>
          )}
        </Link>
      </div>

      <nav ref={navRef} className="admin-scroll relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-5">
        <span
          ref={indicator}
          aria-hidden
          className="pointer-events-none absolute left-3 right-3 top-0 rounded-xl bg-plum/[0.07] opacity-0 ring-1 ring-plum/10 transition-[transform,height,opacity] duration-500 ease-[var(--ease-out-soft)]"
        >
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-3 -translate-y-1/2 rounded-r-full bg-plum" />
        </span>
        {NAV.map((g) => (
          <div key={g.group} className="mb-5 last:mb-0">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-zinc-200" />
            ) : (
              <p className="mb-1.5 px-3 text-[9.5px] font-bold uppercase tracking-[0.24em] text-zinc-400">{g.group}</p>
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.href === activeHref;
                const badge = item.badge ? counts[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-href={item.href}
                    onClick={() => setClicked({ href: item.href, from: realPath })}
                    className={cn(
                      "group/item relative flex items-center gap-3 rounded-xl py-2.5 text-[13.5px] font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-3",
                      active ? "text-plum" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <span className="relative">
                      <item.icon
                        size={18}
                        strokeWidth={active ? 2.2 : 1.8}
                        className="transition-transform duration-300 group-hover/item:scale-110"
                      />
                      {collapsed && badge > 0 && (
                        <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-plum ring-2 ring-white" />
                      )}
                    </span>
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && badge > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          item.badge === "whatsapp" ? "bg-emerald-500 text-white" : "bg-plum/10 text-plum"
                        )}
                        title={item.badge === "whatsapp" ? "Mensagens por ler" : item.badge === "forms" ? "Respostas por ler" : "Sessões hoje"}
                      >
                        {badge}
                      </span>
                    )}
                    {/* Tooltip com a barra recolhida */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-200 group-hover/item:translate-x-0 group-hover/item:opacity-100">
                        {item.label}
                        {badge > 0 && <span className="ml-1.5 text-white/60">{badge}</span>}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-line p-3", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-zinc-50", collapsed && "flex-col")}>
          <Link href="/admin/conta" title="Minha conta" className={cn("flex min-w-0 flex-1 items-center gap-3", collapsed && "flex-none")}>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum text-xs font-bold text-white">
            {initials(user.name)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-950">{user.name}</p>
              <p className="truncate text-[11px] text-zinc-500">{roleLabel(user.role)} · Minha conta</p>
            </div>
          )}
          </Link>
          <form action={logout}>
            <button type="submit" aria-label="Sair" title="Sair" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
              <LogOut size={16} />
            </button>
          </form>
        </div>
        <div className={cn("mt-2 flex gap-2", collapsed && "flex-col")}>
          <Link
            href="/"
            target="_blank"
            title="Ver site"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-[11px] font-semibold text-zinc-500 transition-colors hover:border-plum/30 hover:text-plum"
          >
            <ExternalLink size={13} /> {!collapsed && "Ver site"}
          </Link>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              className="flex items-center justify-center rounded-xl border border-line px-2.5 py-2 text-zinc-500 transition-colors hover:border-plum/30 hover:text-plum"
            >
              <ChevronsLeft size={15} className={cn("transition-transform duration-500", collapsed && "rotate-180")} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------------------- BARRA SUPERIOR ---------------------------- */

function sectionOf(pathname: string) {
  const item = ALL_ITEMS.find((i) => isActive(i.href, pathname));
  const crumbs = [item?.label ?? "Backoffice"];
  if (pathname.startsWith("/admin/crm/")) crumbs.push("Ficha do contacto");
  else if (/\/admin\/cursos\/\d+\/quiz/.test(pathname)) crumbs.push("Curso", "Quiz");
  else if (/\/admin\/cursos\/\d+/.test(pathname)) crumbs.push("Curso");
  return crumbs;
}

// Página interna (ficha, curso, quiz): o telemóvel mostra "voltar" em vez do logótipo
function parentOf(pathname: string) {
  if (pathname.startsWith("/admin/crm/")) return "/admin/contactos";
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 2 ? `/${parts.slice(0, parts.length >= 5 ? 3 : 2).join("/")}` : null;
}

function Topbar({ onCreate, onSearch }: { onCreate: () => void; onSearch: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const crumbs = sectionOf(pathname);
  const parent = parentOf(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [titled, setTitled] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
      setTitled(window.scrollY > 52);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center gap-2 px-4 pt-[env(safe-area-inset-top)] transition-all duration-300 sm:px-6 lg:h-16 lg:gap-3 lg:px-10",
        scrolled ? "border-b border-line bg-canvas/85 backdrop-blur-xl" : "border-b border-transparent"
      )}
    >
      {parent ? (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(parent))}
          className="tap -ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-700 lg:hidden"
          aria-label="Voltar"
        >
          <ChevronLeft size={24} />
        </button>
      ) : (
        <Link href="/admin" aria-label="Início" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2a0a2e] font-display text-[13px] italic text-white lg:hidden">
          ML
        </Link>
      )}

      <nav aria-label="Localização" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="text-zinc-400">Backoffice</span>
        {crumbs.map((c, i) => (
          <span key={c} className="flex min-w-0 items-center gap-2">
            <span className="text-zinc-300">/</span>
            <span className={cn("truncate", i === crumbs.length - 1 ? "font-semibold text-zinc-900" : "text-zinc-500")}>{c}</span>
          </span>
        ))}
      </nav>
      {/* Ao descer na página, o nome da marca dá lugar ao título da secção */}
      <span className="relative h-7 min-w-0 flex-1 overflow-hidden md:hidden">
        <span className={cn("absolute inset-0 truncate font-display text-[17px] font-semibold italic leading-7 text-zinc-950 transition-all duration-300", titled && "-translate-y-3 opacity-0")}>
          Marina Loyola
        </span>
        <span className={cn("absolute inset-0 truncate text-[15px] font-semibold leading-7 text-zinc-950 transition-all duration-300", !titled && "translate-y-3 opacity-0")}>
          {crumbs[crumbs.length - 1]}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onSearch}
          aria-label="Pesquisar"
          className="tap group flex h-9 w-9 items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-sm text-zinc-500 shadow-[0_1px_2px_rgb(24_24_27/0.04)] transition-all hover:border-plum/30 hover:text-zinc-600 sm:h-auto sm:w-64 sm:justify-start sm:px-3 sm:py-2 sm:text-zinc-400"
        >
          <Search size={15} className="transition-colors group-hover:text-plum" />
          <span className="hidden flex-1 text-left sm:inline">Pesquisar ou ir para…</span>
          <span className="kbd hidden sm:inline-flex">⌘K</span>
        </button>
        <WorldClock />
        <button
          type="button"
          onClick={onCreate}
          className="tap flex h-9 w-9 items-center justify-center rounded-xl bg-plum text-white shadow-[0_8px_20px_-8px_rgb(128_0_128/0.7)] lg:hidden"
          aria-label="Criar"
        >
          <Plus size={18} />
        </button>
        <div className="relative hidden lg:block">
          <button
            onClick={() => setNewOpen((o) => !o)}
            onBlur={() => setTimeout(() => setNewOpen(false), 150)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-plum text-white shadow-[0_8px_20px_-8px_rgb(128_0_128/0.7)] transition-transform hover:scale-105 active:scale-95"
            aria-label="Criar"
            title="Criar"
          >
            <Plus size={18} className={cn("transition-transform duration-300", newOpen && "rotate-45")} />
          </button>
          {newOpen && (
            <div className="pop absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[0_20px_50px_-20px_rgb(24_24_27/0.35)]">
              {CREATE_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-plum/[0.06] hover:text-plum"
                >
                  <a.icon size={16} className="text-zinc-400" /> {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Hora de Lisboa e de Brasília: os dois fusos das clientes. */
function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return <span className="hidden w-[188px] xl:block" />;
  return (
    <div className="hidden items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-[0_1px_2px_rgb(24_24_27/0.04)] xl:flex">
      {[
        { tz: "Europe/Lisbon", code: "PT", label: "Lisboa" },
        { tz: "America/Sao_Paulo", code: "BR", label: "Brasília" },
      ].map((z, i) => (
        <span key={z.tz} className="flex items-center gap-1.5">
          {i > 0 && <span className="mr-1.5 h-3 w-px bg-zinc-200" />}
          <span>{flag(z.code)}</span>
          <span className="font-semibold tabular-nums text-zinc-800">{fmtTime(now, z.tz)}</span>
          <span className="text-zinc-400">{z.label}</span>
        </span>
      ))}
    </div>
  );
}

/* --------------------------- PALETA DE COMANDOS -------------------------- */

type Command = { id: string; label: string; hint?: string; icon: LucideIcon; href: string; group: string; superAdmin?: boolean };

const STATIC_COMMANDS: Command[] = [
  ...ALL_ITEMS.map((i) => ({ id: i.href, label: i.label, icon: i.icon, href: i.href, group: "Ir para" })),
  { id: "novo-contacto", label: "Novo contacto", icon: UserPlus, href: "/admin/contactos?novo=1", group: "Ações" },
  { id: "nova-nota", label: "Nova nota", icon: NotebookPen, href: "/admin/notas?nova=1", group: "Ações" },
  { id: "novo-evento", label: "Novo evento na agenda", icon: CalendarPlus, href: "/admin/agenda?view=calendario&modo=semana&evento=novo", group: "Ações" },
  { id: "pagamento", label: "Registar recebimento", icon: Wallet, href: "/admin/financeiro?novo=1", group: "Ações" },
  { id: "despesa", label: "Registar despesa", icon: Wallet, href: "/admin/financeiro?despesa=1", group: "Ações" },
  { id: "semana", label: "Agenda desta semana", icon: CalendarDays, href: "/admin/agenda?view=calendario&modo=semana", group: "Ações" },
  { id: "whats-cfg", label: "Configurar WhatsApp", icon: Settings, href: "/admin/config?s=whatsapp", group: "Ações", superAdmin: true },
  { id: "email-cfg", label: "Configurar email", icon: Settings, href: "/admin/config?s=email", group: "Ações", superAdmin: true },
  { id: "canais", label: "Gerir canais de origem", icon: Settings, href: "/admin/config?s=equipa#canais", group: "Ações" },
  { id: "seguranca", label: "Segurança e Face ID (Configurações)", icon: Settings, href: "/admin/config?s=seguranca", group: "Ações" },
  { id: "conta", label: "Minha conta e Face ID", icon: UserRound, href: "/admin/conta", group: "Ações" },
  { id: "site", label: "Página pública de agendamento", icon: ExternalLink, href: "/agendar", group: "Ações" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function CommandPalette({ open, onClose, superAdmin }: { open: boolean; onClose: () => void; superAdmin: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [people, setPeople] = useState<Command[]>([]);
  const [searching, start] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Pesquisa de contactos com pequeno atraso enquanto se escreve
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const id = window.setTimeout(() => {
      if (term.length < 2) {
        start(() => setPeople([]));
        return;
      }
      start(async () => {
        const rows = await quickSearchContacts(term);
        setPeople(
          rows.map((r) => ({
            id: `c${r.id}`,
            label: r.name,
            hint: [flag(r.country), r.email ?? r.phone].filter(Boolean).join(" "),
            icon: Users,
            href: `/admin/crm/${r.id}`,
            group: "Contactos",
          }))
        );
      });
    }, 150);
    return () => window.clearTimeout(id);
  }, [q, open]);

  const term = normalize(q.trim());
  const allowed = STATIC_COMMANDS.filter((c) => superAdmin || !c.superAdmin);
  const statics = term ? allowed.filter((c) => normalize(c.label).includes(term)) : allowed;
  const items = [...people, ...statics];
  const current = Math.min(sel, Math.max(items.length - 1, 0));

  // Mantém a opção escolhida com as setas sempre visível na lista
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const go = useCallback(
    (c: Command | undefined) => {
      if (!c) return;
      onClose();
      setQ("");
      setSel(0);
      if (c.href.startsWith("/agendar")) window.open(c.href, "_blank");
      else router.push(c.href);
    },
    [onClose, router]
  );

  let lastGroup = "";
  return (
    <dialog
      ref={ref}
      onClose={() => {
        onClose();
        setQ("");
        setSel(0);
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto mt-[max(0.75rem,env(safe-area-inset-top))] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden sm:mt-[12vh] sm:w-[calc(100%-2rem)] rounded-[22px] border border-line bg-white p-0 text-left shadow-[0_30px_80px_-20px_rgb(24_24_27/0.45)] backdrop:bg-zinc-950/30 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(items[current]);
            }
          }}
        >
          <div className="flex items-center gap-3 border-b border-line px-5">
            {searching ? <Loader2 size={18} className="animate-spin text-plum" /> : <Search size={18} className="text-zinc-400" />}
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              placeholder="Pesquisar contactos, páginas e ações…"
              className="h-14 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <span className="kbd hidden sm:inline-flex">Esc</span>
            <button type="button" onClick={onClose} className="text-[13px] font-semibold text-plum sm:hidden">
              Fechar
            </button>
          </div>
          <ul ref={listRef} className="admin-scroll max-h-[50vh] overflow-y-auto scroll-py-2 p-2">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-zinc-500">Nada encontrado para “{q}”.</li>}
            {items.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <li key={c.id} data-i={i}>
                  {header && <p className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{header}</p>}
                  <button
                    type="button"
                    onMouseMove={() => i !== current && setSel(i)}
                    onClick={() => go(c)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      i === current ? "bg-plum/[0.07] text-plum" : "text-zinc-700"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        i === current ? "bg-plum text-white" : "bg-zinc-100 text-zinc-500"
                      )}
                    >
                      <c.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.label}</span>
                      {c.hint && <span className="block truncate text-xs text-zinc-500">{c.hint}</span>}
                    </span>
                    {i === current ? <CornerDownLeft size={14} className="shrink-0 opacity-60" /> : <ArrowRight size={14} className="shrink-0 opacity-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden items-center gap-4 border-t border-line bg-zinc-50/60 px-5 py-2.5 text-[11px] text-zinc-500 sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span> navegar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="kbd">↵</span> abrir
            </span>
            <span className="ml-auto">
              Atalho <span className="kbd">⌘K</span> ou <span className="kbd">/</span>
            </span>
          </div>
        </div>
      )}
    </dialog>
  );
}
