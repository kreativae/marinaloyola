"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Painéis que sobem do fundo do ecrã, como numa app: fecham com um toque fora
 * ou arrastando para baixo. Só o telemóvel os usa.
 */

const CLOSE_AT = 90; // px arrastados a partir dos quais o painel fecha

/** Arrastar para baixo para fechar. Devolve os eventos para a pega (ou cabeçalho) do painel. */
export function useSwipeToClose<T extends HTMLElement>(onClose: () => void) {
  const panel = useRef<T>(null);
  const startY = useRef<number | null>(null);
  const delta = useRef(0);

  const reset = () => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = "";
    el.style.transform = "";
  };

  return {
    panel,
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
        startY.current = e.clientY;
        delta.current = 0;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (panel.current) panel.current.style.transition = "none";
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        if (startY.current === null || !panel.current) return;
        delta.current = Math.max(0, e.clientY - startY.current);
        panel.current.style.transform = `translateY(${delta.current}px)`;
      },
      onPointerUp: () => {
        if (startY.current === null) return;
        startY.current = null;
        const el = panel.current;
        if (!el) return;
        el.style.transition = "transform 0.24s var(--ease-out-soft)";
        if (delta.current > CLOSE_AT) {
          el.style.transform = "translateY(100%)";
          window.setTimeout(() => {
            onClose();
            reset();
          }, 200);
        } else {
          el.style.transform = "translateY(0)";
          window.setTimeout(reset, 240);
        }
      },
      onPointerCancel: () => {
        startY.current = null;
        reset();
      },
    },
  };
}

export function SheetHandle() {
  return (
    <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-zinc-300" />
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { panel, handlers } = useSwipeToClose<HTMLDivElement>(onClose);

  // Com o painel aberto a página de trás não mexe, e Esc fecha
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 animate-[backdrop-in_0.2s_ease] bg-zinc-950/35"
      />
      <div
        ref={panel}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-[sheet-up_0.32s_var(--ease-out-soft)] flex-col rounded-t-[26px] bg-white shadow-[0_-20px_60px_-20px_rgb(24_24_27/0.4)]",
          className
        )}
      >
        <div {...handlers} className="shrink-0 touch-none px-5 pb-2 pt-2.5">
          <SheetHandle />
          {title && <h2 className="mt-3 font-display text-[1.3rem] leading-tight text-zinc-950">{title}</h2>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
