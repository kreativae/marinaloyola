import { ArrowUpRight, CalendarDays, Check, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/site";
import { Href, Rich, Sections } from "@/components/site-text";
import { getSetting } from "@/lib/settings";
import { getSitePage, siteMetadata } from "@/lib/site-content";

export const generateMetadata = () => siteMetadata("mentoria");

async function whatsappNumber() {
  try {
    return (await getSetting("whatsapp_number")) || "351912345678";
  } catch {
    return "351912345678";
  }
}

export default async function MentoriaPage() {
  const [wa, page] = await Promise.all([whatsappNumber(), getSitePage("mentoria")]);
  const { hero, offer, program, faq, cta } = page.s;
  const waLink = `https://wa.me/${wa}?text=${encodeURIComponent(hero.waMessage)}`;

  return (
    <Sections
      page={page}
      blocks={{
        hero: () => (
          <section className="grain relative overflow-hidden bg-white pb-12 pt-16 text-zinc-950 lg:pt-24">
            <div className="glow-plum pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px]" />
            <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker flex items-center gap-3">
                  <span className="h-px w-10 bg-plum-bright" /> {hero.kicker}
                </p>
                <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
                  <Rich text={hero.title} />
                </h1>
                <p className="mt-7 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-zinc-500">{hero.text}</p>
                <div className="mt-10 flex flex-wrap gap-4">
                  {hero.waLabel && (
                    <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary">
                      <MessageCircle size={16} />
                      {hero.waLabel}
                    </a>
                  )}
                  {hero.cta2Label && (
                    <Href href={hero.cta2Href} className="btn-ghost">
                      <CalendarDays size={16} />
                      {hero.cta2Label}
                    </Href>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        ),

        offer: () => (
          <section className="bg-white pb-24 pt-12">
            <div className="mx-auto grid max-w-7xl gap-6 px-5 lg:grid-cols-2 lg:px-8">
              <Reveal>
                <div className="h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:p-10">
                  <h2 className="font-display text-2xl italic text-plum">{offer.forWhomTitle}</h2>
                  <ul className="mt-7 space-y-4">
                    {offer.forWhom.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-600">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-plum/30">
                          <Check size={12} className="text-plum" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={140}>
                <div className="h-full rounded-3xl border border-plum/40 bg-plum/[0.04] p-8 lg:p-10">
                  <h2 className="font-display text-2xl italic">{offer.formatTitle}</h2>
                  <ul className="mt-7 space-y-4 text-sm leading-relaxed text-zinc-600">
                    {offer.format.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200/70">
                          <Check size={12} className="text-plum" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {offer.price && (
                    <div className="mt-8 border-t border-zinc-200 pt-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">{offer.priceLabel}</p>
                      <p className="mt-2 font-display text-5xl font-semibold">
                        {offer.price}
                        {offer.priceNote && <span className="ml-2 align-middle text-sm font-normal text-zinc-500">{offer.priceNote}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        ),

        program: () => (
          <section className="bg-white py-24 lg:py-32">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker-dark">{program.kicker}</p>
                <h2 className="mt-5 max-w-2xl font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-5xl">
                  <Rich text={program.title} />
                </h2>
              </Reveal>
              <div className="mt-14 grid gap-6 sm:grid-cols-2">
                {program.items.map((p, i) => (
                  <Reveal key={i} delay={i * 90}>
                    <div className="group h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-8 transition-all duration-500 hover:border-plum/50 hover:bg-white hover:shadow-[0_24px_60px_-24px_rgba(128,0,128,0.3)]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-plum">{p.phase}</p>
                      <h3 className="mt-4 font-display text-2xl text-zinc-950">{p.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{p.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),

        faq: () => (
          <section className="bg-zinc-50 py-24 lg:py-28">
            <div className="mx-auto max-w-3xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker-dark">{faq.kicker}</p>
                <h2 className="mt-5 font-display text-4xl font-medium tracking-tight text-zinc-950">
                  <Rich text={faq.title} />
                </h2>
              </Reveal>
              <div className="mt-10 space-y-3">
                {faq.items.map((f, i) => (
                  <Reveal key={i} delay={i * 60}>
                    <details className="group rounded-2xl border border-zinc-200 bg-white p-6 open:border-plum/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg text-zinc-950">
                        {f.q}
                        <ArrowUpRight size={18} className="shrink-0 text-plum transition-transform group-open:rotate-45" />
                      </summary>
                      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-600">{f.a}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),

        cta: () => (
          <section className="bg-zinc-50 pb-24 lg:pb-28">
            <div className="mx-auto max-w-3xl px-5 lg:px-8">
              <Reveal>
                <div className="rounded-3xl border border-plum/15 bg-plum/[0.05] p-10 text-center text-zinc-950">
                  <h3 className="font-display text-3xl italic">
                    <Rich text={cta.title} em="text-plum" />
                  </h3>
                  <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-sm text-zinc-600">{cta.text}</p>
                  <div className="mt-7 flex flex-wrap justify-center gap-4">
                    {cta.ctaLabel && (
                      <Href href={cta.ctaHref} className="btn-primary">
                        <CalendarDays size={16} /> {cta.ctaLabel}
                      </Href>
                    )}
                    <a href={waLink} target="_blank" rel="noreferrer" className="btn-ghost">
                      <MessageCircle size={16} /> WhatsApp
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        ),
      }}
    />
  );
}
