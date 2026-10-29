import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { Reveal } from "@/components/site";
import { BookingFlow } from "@/components/booking";
import { getBookingRules } from "@/lib/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agendar sessão",
  description:
    "Agende uma sessão exploratória, mentoria ou workshop com Marina Loyola. Disponibilidade em tempo real, confirmação imediata e link Zoom automático.",
};

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ tipo?: string; data?: string }> }) {
  const sp = await searchParams;
  const types = await db
    .select({
      id: eventTypes.id,
      name: eventTypes.name,
      description: eventTypes.description,
      durationMin: eventTypes.durationMin,
    })
    .from(eventTypes)
    .where(eq(eventTypes.active, true));
  const rules = await getBookingRules();

  return (
    <section className="grain relative overflow-hidden bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
      <div className="glow-plum pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <p className="kicker flex items-center gap-3">
            <span className="h-px w-10 bg-plum-bright" /> Agenda online
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-6xl">
            Escolha o momento.{" "}
            <span className="italic text-plum">O resto é comigo.</span>
          </h1>
          <p className="mt-6 max-w-xl text-zinc-500">
            Disponibilidade em tempo real. A confirmação chega por email e WhatsApp com o
            link do Zoom — e os lembretes também.
          </p>
        </Reveal>
        <div className="mt-12">
          <Reveal delay={140}>
            {types.length > 0 ? (
              <BookingFlow
                types={types}
                windowDays={rules.windowDays}
                initialTypeId={Number(sp.tipo) || undefined}
                initialDate={/^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data : undefined}
              />
            ) : (
              <p className="rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500">
                A agenda está temporariamente indisponível. Fale comigo pelo WhatsApp.
              </p>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
