"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima o primeiro número de um texto já formatado ("4.501,00 €", "12", "75%"),
 * de 0 até ao valor, mantendo o formato (ponto nos milhares, vírgula nas décimas).
 * O HTML do servidor já traz o valor final: sem JavaScript, ou com movimento reduzido, não anima.
 */
export function CountUp({ value, duration = 900 }: { value: string; duration?: number }) {
  const match = value.match(/-?\d[\d.]*(,\d+)?/);
  const [shown, setShown] = useState(value);
  const [last, setLast] = useState(value);
  const done = useRef(false);
  // Valor novo vindo do servidor (ex: depois de uma acção): mostra-o de imediato
  if (value !== last) {
    setLast(value);
    setShown(value);
  }

  useEffect(() => {
    if (!match || done.current) return;
    done.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raw = match[0];
    const decimals = raw.includes(",") ? raw.split(",")[1].length : 0;
    const target = Number(raw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(target) || target === 0) return;
    const [before, after] = [value.slice(0, match.index), value.slice(match.index! + raw.length)];
    const fmt = (n: number) => {
      const [i, f] = n.toFixed(decimals).split(".");
      return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${f ? `,${f}` : ""}`;
    };
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(`${before}${fmt(target * eased)}${after}`);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <span className="tabular-nums">{shown}</span>;
}
