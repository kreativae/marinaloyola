"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";

/**
 * O que faz o site comportar-se como uma app no telemóvel. Aberta a partir do ecrã
 * inicial não há botão de recarregar, por isso os dados têm de se atualizar sozinhos.
 */

const TRIGGER = 64; // distância a partir da qual, ao largar, a página atualiza
const MAX_PULL = 104;
const HOLD = 52; // onde o indicador fica enquanto atualiza
const AWAY_MS = 60_000; // tempo fora da app a partir do qual os dados voltam a ser pedidos

/** Um painel aberto, ou uma lista interior já deslizada, ficam com o gesto para si. */
function pullBlocked(target: EventTarget | null) {
  if (document.body.style.overflow === "hidden") return true;
  if (document.querySelector("dialog[open], [aria-modal='true'], .wa-thread")) return true;
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0 || el.classList.contains("touch-none")) return true;
  }
  return false;
}

function usePullToRefresh() {
  const router = useRouter();
  const indicator = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const [waiting, setWaiting] = useState(false);
  const [pending, start] = useTransition();
  const spinning = waiting || pending;
  const busy = useRef(false);

  useEffect(() => {
    busy.current = spinning;
    const el = indicator.current;
    if (!el) return;
    el.style.transition = "";
    el.style.opacity = spinning ? "1" : "0";
    el.style.transform = `translate(-50%, ${spinning ? HOLD : 0}px)`;
  }, [spinning]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.overscrollBehaviorY = "contain"; // sem isto o browser atualiza a página inteira
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    let dist = 0;

    const paint = () => {
      const el = indicator.current;
      if (!el) return;
      el.style.transition = "none";
      el.style.opacity = String(Math.min(1, dist / TRIGGER));
      el.style.transform = `translate(-50%, ${dist}px)`;
      if (icon.current) icon.current.style.transform = `rotate(${dist * 4}deg) scale(${dist >= TRIGGER ? 1.12 : 1})`;
    };

    const onStart = (e: TouchEvent) => {
      tracking = false;
      pulling = false;
      dist = 0;
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0 || pullBlocked(e.target)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!pulling) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dy <= 0 || Math.abs(dx) > dy) {
          tracking = false; // deslizar para o lado ou para cima não é puxar
          return;
        }
        pulling = true;
      }
      if (e.cancelable) e.preventDefault();
      dist = Math.min(MAX_PULL, Math.max(0, dy * 0.5));
      paint();
    };

    const onEnd = () => {
      if (!pulling) return;
      const fire = dist >= TRIGGER;
      tracking = false;
      pulling = false;
      dist = 0;
      if (fire) {
        setWaiting(true);
        start(() => router.refresh());
        window.setTimeout(() => setWaiting(false), 500); // tempo mínimo para se perceber que atualizou
      } else if (indicator.current) {
        indicator.current.style.transition = "";
        indicator.current.style.opacity = "0";
        indicator.current.style.transform = "translate(-50%, 0)";
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      root.style.overscrollBehaviorY = "";
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  return { indicator, icon, spinning };
}

/** Quem volta à app depois de um tempo fora vê os dados de agora, não os de quando saiu. */
function useRefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let leftAt = 0;
    const onChange = () => {
      if (document.hidden) {
        leftAt = Date.now();
        return;
      }
      const typing = document.activeElement?.matches("input, textarea, select");
      if (leftAt && Date.now() - leftAt > AWAY_MS && !typing) router.refresh();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function AppBehaviors() {
  const { indicator, icon, spinning } = usePullToRefresh();
  useRefreshOnReturn();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  return (
    <>
      <div
        ref={indicator}
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)-2.25rem)] z-[45] flex h-9 w-9 items-center justify-center rounded-full bg-white text-plum opacity-0 shadow-[0_6px_20px_-6px_rgb(24_24_27/0.35)] ring-1 ring-zinc-200/70 transition-[transform,opacity] duration-300 ease-[var(--ease-out-soft)] lg:hidden"
        style={{ transform: "translate(-50%, 0)" }}
      >
        <span ref={icon} className="flex transition-transform duration-150">
          <Loader2 size={18} className={spinning ? "animate-spin" : undefined} />
        </span>
      </div>
      {!online && (
        <p
          role="status"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[45] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <WifiOff size={13} /> Sem ligação à internet
        </p>
      )}
    </>
  );
}
