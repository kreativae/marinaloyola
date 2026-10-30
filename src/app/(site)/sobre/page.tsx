import { ArrowRight, CalendarDays } from "lucide-react";
import { Reveal } from "@/components/site";
import { Href, Paras, Rich, Sections, SiteIcon, SiteImg } from "@/components/site-text";
import { getSitePage, siteMetadata } from "@/lib/site-content";

export const generateMetadata = () => siteMetadata("sobre");

export default async function SobrePage() {
  const page = await getSitePage("sobre");
  const { intro, timeline, values } = page.s;

  return (
    <Sections
      page={page}
      blocks={{
        intro: () => (
          <section className="bg-white pb-0 pt-16 text-zinc-950 lg:pt-24">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker flex items-center gap-3">
                  <span className="h-px w-10 bg-plum-bright" /> {intro.kicker}
                </p>
                <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
                  <Rich text={intro.title} />
                </h1>
              </Reveal>
            </div>
            <div className="mx-auto mt-16 grid max-w-7xl items-start gap-14 px-5 pb-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
              <Reveal>
                <div className="relative">
                  <div className="absolute -inset-3 -rotate-2 rounded-[2rem] border border-plum/40" />
                  <SiteImg src={intro.image} alt={intro.quoteAuthor} width={800} height={640} className="relative h-[440px] w-full rounded-[1.8rem] border border-zinc-200 object-cover" />
                  {intro.quote && (
                    <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                      <p className="font-display text-xl italic leading-relaxed text-zinc-800">“{intro.quote}”</p>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.25em] text-plum">{intro.quoteAuthor}</p>
                    </div>
                  )}
                </div>
              </Reveal>
              <Reveal delay={140}>
                <div className="space-y-5 leading-relaxed text-zinc-500">
                  {intro.lead && <p className="text-lg text-zinc-800">{intro.lead}</p>}
                  <Paras text={intro.body} />
                </div>
                <div className="mt-10 flex flex-wrap gap-4">
                  {intro.cta1Label && (
                    <Href href={intro.cta1Href} className="btn-primary">
                      {intro.cta1Label}
                      <ArrowRight size={16} />
                    </Href>
                  )}
                  {intro.cta2Label && (
                    <Href href={intro.cta2Href} className="btn-ghost">
                      <CalendarDays size={16} />
                      {intro.cta2Label}
                    </Href>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        ),

        timeline: () => (
          <section className="bg-white py-24 lg:py-32">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker-dark">{timeline.kicker}</p>
                <h2 className="mt-5 font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-5xl">
                  <Rich text={timeline.title} />
                </h2>
              </Reveal>
              <div className="mt-14 space-y-0">
                {timeline.items.map((it, i) => (
                  <Reveal key={i} delay={i * 80}>
                    <div className="group grid gap-2 border-t border-zinc-200 py-8 transition-colors last:border-b hover:bg-zinc-50 sm:grid-cols-[120px_220px_1fr] sm:items-baseline sm:gap-8 sm:px-4">
                      <p className="font-display text-3xl italic text-plum">{it.year}</p>
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-950">{it.title}</p>
                      <p className="text-sm leading-relaxed text-zinc-600">{it.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),

        values: () => (
          <section className="grain bg-white py-24 text-zinc-950 lg:py-32">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker">{values.kicker}</p>
                <h2 className="mt-5 max-w-2xl font-display text-4xl font-medium tracking-tight lg:text-5xl">
                  <Rich text={values.title} />
                </h2>
              </Reveal>
              <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {values.items.map((v, i) => (
                  <Reveal key={i} delay={i * 100}>
                    <div className="h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-7 transition-colors duration-500 hover:border-plum/50 hover:bg-plum/[0.05]">
                      <SiteIcon name={v.icon} size={24} className="text-plum" />
                      <h3 className="mt-6 font-display text-xl">{v.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-500">{v.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),
      }}
    />
  );
}
