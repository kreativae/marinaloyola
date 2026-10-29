"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cityOf, countryName, flag, fmtTime, hoursFromHome, HOME_TZ } from "@/lib/timezones";
import { cn } from "@/lib/utils";

/**
 * "Agora são 09:42 em Brasília · 3 h atrás de Lisboa" — actualiza a cada minuto.
 * A hora é calculada no fuso do contacto, por isso servidor e browser dão o mesmo texto
 * (excepto na mudança de minuto, daí o suppressHydrationWarning).
 */
export function LocalTime({
  timezone,
  country,
  className,
}: {
  timezone: string;
  country?: string | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const diff = hoursFromHome(timezone, now);
  const hour = Number(fmtTime(now, timezone).slice(0, 2));
  const night = hour < 8 || hour >= 22;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      <Clock size={13} className={cn("shrink-0", night ? "text-amber-600" : "text-plum")} />
      <span suppressHydrationWarning>
        Agora são <b className="font-semibold text-zinc-900">{fmtTime(now, timezone)}</b> em {cityOf(timezone)}
        {country ? ` ${flag(country)}` : ""}
      </span>
      {timezone !== HOME_TZ && diff !== 0 && (
        <span className="text-zinc-400">
          · {Math.abs(diff)} h {diff < 0 ? "atrás" : "à frente"} de Lisboa
        </span>
      )}
      {night && <span className="font-semibold text-amber-700">· fora de horas</span>}
    </span>
  );
}

export function CountryLabel({ code }: { code: string | null | undefined }) {
  if (!code) return null;
  return (
    <span className="whitespace-nowrap">
      {flag(code)} {countryName(code)}
    </span>
  );
}
