"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barra de progresso no topo durante a navegação entre páginas.
 * O App Router não emite eventos de rota: o início é detectado pelo clique num link
 * interno (ou submissão de um formulário GET) e o fim pela mudança de URL.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const bar = useRef<HTMLDivElement>(null);
  const state = useRef<{ active: boolean; width: number; timer?: number; hide?: number }>({
    active: false,
    width: 0,
  });

  useEffect(() => {
    const s = state.current;
    const el = bar.current;
    if (!s.active || !el) return;
    window.clearInterval(s.timer);
    s.active = false;
    el.style.width = "100%";
    s.hide = window.setTimeout(() => {
      el.style.opacity = "0";
      s.hide = window.setTimeout(() => {
        el.style.transition = "none";
        el.style.width = "0%";
      }, 250);
    }, 180);
  }, [pathname, search]);

  useEffect(() => {
    const s = state.current;
    const start = () => {
      const el = bar.current;
      if (!el || s.active) return;
      s.active = true;
      window.clearTimeout(s.hide);
      s.width = 12;
      el.style.transition = "width 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease";
      el.style.opacity = "1";
      el.style.width = `${s.width}%`;
      // Avança cada vez mais devagar até ~90% enquanto a página carrega
      s.timer = window.setInterval(() => {
        s.width += (90 - s.width) * 0.12;
        el.style.width = `${s.width}%`;
      }, 250);
    };

    const isSameUrl = (url: URL) =>
      url.pathname === window.location.pathname && url.search === window.location.search;

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || isSameUrl(url)) return;
      if (url.pathname.startsWith("/api/") || /\/export(\/|$)/.test(url.pathname)) return;
      start();
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // getAttribute: form.method pode ser um <input name="method"> do próprio formulário
      if ((form.getAttribute("method") ?? "get").toLowerCase() !== "get") return;
      const action = form.getAttribute("action");
      if (action?.startsWith("javascript:")) return;
      // Depois dos handlers: formulários tratados em JavaScript (modais que gravam) não navegam;
      // o <Form> do Next também cancela o envio, mas tem um action com caminho e navega
      window.setTimeout(() => {
        if (e.defaultPrevented && !action?.startsWith("/")) return;
        start();
      }, 0);
    };

    // Fase de captura: corre antes do Link do Next chamar preventDefault()
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.clearInterval(s.timer);
      window.clearTimeout(s.hide);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2.5px]" aria-hidden>
      <div
        ref={bar}
        className="h-full bg-plum shadow-[0_0_10px_rgba(128,0,128,0.45)]"
        style={{ width: "0%", opacity: 0 }}
      />
    </div>
  );
}
