import { eq } from "drizzle-orm";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { Reveal } from "@/components/site";
import { BookingFlow } from "@/components/booking";
import { Rich } from "@/components/site-text";
import { getBookingRules } from "@/lib/actions";
import { getSitePage, siteMetadata } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export const generateMetadata = () => siteMetadata("agendar");

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ tipo?: string; data?: string }> }) {
  const sp = await searchParams;
  const [types, rules, page] = await Promise.all([
    db
      .select({
        id: eventTypes.id,
        name: eventTypes.name,
        description: eventTypes.description,
        durationMin: eventTypes.durationMin,
      })
      .from(eventTypes)
      .where(eq(eventTypes.active, true)),
    getBookingRules(),
    getSitePage("agendar"),
  ]);
  const { hero } = page.s;

  return (
    <section id="bloco-hero" className="grain relative overflow-hidden bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
      <div className="glow-plum pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <p className="kicker flex items-center gap-3">
            <span className="h-px w-10 bg-plum-bright" /> {hero.kicker}
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-6xl">
            <Rich text={hero.title} />
          </h1>
          <p className="mt-6 max-w-xl whitespace-pre-line text-zinc-500">{hero.text}</p>
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
              <p className="rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500">{hero.empty}</p>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
