"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, Briefcase, CalendarDays, Mail, Menu, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/sobre", label: "Sobre" },
  { href: "/mentoria", label: "Mentoria" },
  { href: "/cursos", label: "Cursos" },
  { href: "/contato", label: "Contacto" },
];

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function Header({ whatsapp }: { whatsapp: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold italic text-zinc-950 transition-colors group-hover:text-plum">
              Marina Loyola
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 sm:block">
              Design & Mentoria
            </span>
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("nav-link", pathname === item.href && "nav-link-active")}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/agendar"
              className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition-all hover:bg-plum-bright"
            >
              <CalendarDays size={15} />
              Agendar
            </Link>
          </nav>
          <button
            onClick={() => setOpen(!open)}
            className="text-zinc-950 lg:hidden"
            aria-label="Menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-white/98 pt-24 backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col items-center gap-7 px-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-display text-3xl italic text-zinc-950"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/agendar" className="btn-primary mt-4">
              <CalendarDays size={16} /> Agendar sessão
            </Link>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá Marina! Gostaria de saber mais sobre a mentoria.")}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          </nav>
        </div>
      )}
    </>
  );
}

export function WhatsAppFloat({ number }: { number: string }) {
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent("Olá Marina! Vim do site e gostaria de mais informações.")}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 animate-pulse-ring items-center justify-center rounded-full bg-plum text-white transition-transform hover:scale-110"
    >
      <MessageCircle size={24} fill="currentColor" />
    </a>
  );
}

export function Footer({ whatsapp, email }: { whatsapp: string; email: string }) {
  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <p className="font-display text-3xl font-semibold italic">Marina Loyola</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
            Design & Mentoria
          </p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-zinc-500">
            Design com estratégia, marcas com alma. Mentoria, workshops e cursos para
            designers que querem construir um negócio criativo sólido e sofisticado.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="https://instagram.com/marinaloyola"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-plum hover:text-plum"
            >
              <AtSign size={17} />
            </a>
            <a
              href="https://linkedin.com/in/marinaloyola"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-plum hover:text-plum"
            >
              <Briefcase size={17} />
            </a>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-plum hover:text-plum"
            >
              <MessageCircle size={17} />
            </a>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Navegação
          </p>
          <ul className="mt-5 space-y-3 text-sm text-zinc-600">
            {[...NAV, { href: "/agendar", label: "Agendar sessão" }].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-plum">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Contacto
          </p>
          <ul className="mt-5 space-y-3 text-sm text-zinc-600">
            <li className="flex items-center gap-2">
              <Mail size={14} className="text-plum" />
              <a href={`mailto:${email}`} className="hover:text-plum">
                {email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle size={14} className="text-plum" />
              <a href={`https://wa.me/${whatsapp}`} className="hover:text-plum">
                WhatsApp direto
              </a>
            </li>
          </ul>
          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Legal
          </p>
          <ul className="mt-4 space-y-3 text-sm text-zinc-500">
            <li>
              <Link href="/legal#privacidade" className="hover:text-plum">
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link href="/legal#termos" className="hover:text-plum">
                Termos e Condições
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Marina Loyola · marinaloyola.com · Todos os direitos
        reservados · RGPD compliant
      </div>
    </footer>
  );
}
