"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Award, ListChecks } from "lucide-react";
import { BottomSheet } from "@/components/sheet";

/** Barra da aula no telemóvel: anterior, lista de aulas e seguinte sempre à mão do polegar. */
export function LessonBar({
  prevHref,
  nextHref,
  certHref,
  label,
  children,
}: {
  prevHref: string | null;
  nextHref: string | null;
  certHref: string | null;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  // Abre já na aula em que se está, mesmo num curso comprido
  useEffect(() => {
    if (open) list.current?.querySelector("[aria-current='page']")?.scrollIntoView({ block: "center" });
  }, [open]);

  const side = "tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full";
  return (
    <>
      <nav
        aria-label="Navegação da aula"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {prevHref ? (
            <Link href={prevHref} aria-label="Aula anterior" className={`${side} bg-zinc-100 text-zinc-700`}>
              <ArrowLeft size={18} />
            </Link>
          ) : (
            <span aria-hidden className={`${side} bg-zinc-50 text-zinc-300`}>
              <ArrowLeft size={18} />
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="tap flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-zinc-100 px-4 text-[13px] font-semibold text-zinc-800"
          >
            <ListChecks size={15} className="shrink-0 text-plum" />
            <span className="truncate">{label}</span>
          </button>
          {nextHref ? (
            <Link href={nextHref} aria-label="Próxima aula" className={`${side} bg-plum text-white`}>
              <ArrowRight size={18} />
            </Link>
          ) : certHref ? (
            <Link href={certHref} aria-label="Emitir certificado" className={`${side} bg-plum text-white`}>
              <Award size={18} />
            </Link>
          ) : (
            <span aria-hidden className={`${side} bg-zinc-50 text-zinc-300`}>
              <ArrowRight size={18} />
            </span>
          )}
        </div>
      </nav>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Aulas do curso">
        <div
          ref={list}
          className="pt-2"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </div>
      </BottomSheet>
    </>
  );
}
