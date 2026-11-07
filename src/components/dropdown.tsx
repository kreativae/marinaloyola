"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/sheet";
import { cn } from "@/lib/utils";

type Place = { top?: number; bottom?: number; left: number; right: number; side?: "left" | "right" };

/**
 * Menu que abre junto ao botão no computador e como painel no telemóvel.
 * No computador fica em posição fixa: dentro de uma tabela que desliza não é cortado.
 */
export function useMenu() {
  const [open, setOpen] = useState<"pop" | "sheet" | "inline" | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open !== "pop" && open !== "inline") return;
    const close = () => setOpen(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!wrap.current?.contains(t) && !t.closest?.("[data-dropdown]")) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return {
    wrap,
    open,
    place,
    toggle: () => {
      if (open) return setOpen(null);
      // Dentro de uma janela (dialog) o menu fica preso ao botão, por cima dela
      const dlg = wrap.current?.closest("dialog");
      if (dlg && wrap.current) {
        // Cresce para o lado onde a janela tem espaço
        const d = dlg.getBoundingClientRect();
        const r = wrap.current.getBoundingClientRect();
        setPlace({ left: 0, right: 0, side: r.left - d.left < d.right - r.right ? "left" : "right" });
        return setOpen("inline");
      }
      if (window.matchMedia("(max-width: 639px)").matches) return setOpen("sheet");
      const r = wrap.current?.getBoundingClientRect();
      if (r) {
        const up = window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom;
        setPlace({ ...(up ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }), left: r.left, right: window.innerWidth - r.right });
      }
      setOpen("pop");
    },
    close: () => setOpen(null),
  };
}

export function MenuPanel({
  open,
  place,
  onClose,
  title,
  align = "right",
  children,
}: {
  open: "pop" | "sheet" | "inline" | null;
  place: Place | null;
  onClose: () => void;
  title: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <>
      {open === "pop" && place && (
        <div
          role="menu"
          data-dropdown
          style={{
            top: place.top,
            bottom: place.bottom,
            ...(align === "right" ? { right: place.right } : { left: place.left }),
          }}
          className="pop fixed z-[60] w-64 overflow-hidden rounded-2xl border border-line bg-white p-1.5 text-left shadow-[0_20px_50px_-20px_rgb(24_24_27/0.35)]"
        >
          {children}
        </div>
      )}
      {open === "inline" && (
        <div
          role="menu"
          data-dropdown
          className={cn(
            "pop absolute bottom-[calc(100%+0.5rem)] z-[60] w-60 overflow-hidden rounded-2xl border border-line bg-white p-1.5 text-left shadow-[0_20px_50px_-20px_rgb(24_24_27/0.35)]",
            place?.side === "left" ? "left-0" : "right-0"
          )}
        >
          {children}
        </div>
      )}
      <BottomSheet open={open === "sheet"} onClose={onClose} title={title}>
        <div role="menu" className="pb-2 pt-1 text-left [&_[role=menuitem]]:py-3.5">
          {children}
        </div>
      </BottomSheet>
    </>
  );
}

export const menuItemClass =
  "tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50";

export type Choice = { value: string; label: string; tone?: string };

const NEUTRAL = "bg-zinc-500/10 text-zinc-600 border-zinc-500/30";

/**
 * Escolher um estado: pastilha com a cor do estado e lista com as mesmas cores.
 * A mudança aparece de imediato; o servidor confirma por trás.
 */
export function ChoicePicker({
  value,
  options,
  onSelect,
  title,
  prefix,
  size = "md",
  align = "right",
  className,
}: {
  value: string;
  options: Choice[];
  onSelect: (value: string) => Promise<unknown>;
  title: string;
  /** Palavra pequena antes do valor, ex.: "Fase" */
  prefix?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
}) {
  const { wrap, ...menu } = useMenu();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useOptimistic(value);
  const opt = options.find((o) => o.value === current);

  const pick = (v: string) => {
    menu.close();
    if (v === current) return;
    start(async () => {
      setCurrent(v);
      await onSelect(v);
    });
  };

  return (
    <div ref={wrap} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={menu.toggle}
        aria-haspopup="menu"
        aria-expanded={!!menu.open}
        title={title}
        className={cn(
          "tap inline-flex items-center whitespace-nowrap rounded-full border font-semibold transition-shadow hover:shadow-[0_4px_14px_-6px_currentColor]",
          size === "sm" ? "h-8 gap-1.5 px-3 text-[11.5px]" : "h-[38px] gap-2 px-4 text-xs",
          opt?.tone ?? NEUTRAL
        )}
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        {prefix && <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">{prefix}</span>}
        {opt?.label ?? current}
        <ChevronDown size={size === "sm" ? 12 : 13} className={cn("-mr-0.5 opacity-60 transition-transform duration-200", menu.open && "rotate-180")} />
      </button>
      <MenuPanel open={menu.open} place={menu.place} onClose={menu.close} title={title} align={align}>
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 max-sm:hidden">{title}</p>
        {options.map((o) => {
          const on = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              role="menuitem"
              onClick={() => pick(o.value)}
              className={cn(menuItemClass, on ? "bg-zinc-50 font-semibold text-zinc-950" : "text-zinc-700 hover:bg-zinc-50")}
            >
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", o.tone ?? NEUTRAL)}>
                <span className="h-2 w-2 rounded-full bg-current" />
              </span>
              <span className="flex-1">{o.label}</span>
              {on && <Check size={15} className="text-plum" />}
            </button>
          );
        })}
      </MenuPanel>
    </div>
  );
}
