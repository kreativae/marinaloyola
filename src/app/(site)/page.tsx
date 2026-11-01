import { ArrowRight, ArrowUpRight, CalendarDays, Check, Quote, Sparkles } from "lucide-react";
import { Reveal } from "@/components/site";
import { Href, Rich, Sections, SiteIcon, SiteImg } from "@/components/site-text";
import { submitLead } from "@/lib/actions";
import { getSitePage, siteMetadata } from "@/lib/site-content";

export const generateMetadata = () => siteMetadata("inicio");

export default async function HomePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const page = await getSitePage("inicio");
  const { hero, marquee, services, method, testimonials, featured, newsletter, cta } = page.s;

  return (
    <Sections
      page={page}
      blocks={{
        /* ------------------------------- HERO ------------------------------ */
        hero: () => (
          <section className="grain relative overflow-hidden bg-white text-zinc-950">
            <div className="glow-plum pointer-events-none absolute -left-40 top-10 h-[560px] w-[560px]" />
            <div className="glow-plum pointer-events-none absolute -right-52 bottom-0 h-[620px] w-[620px]" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-32 lg:pt-24">
              <div>
                <Reveal>
                  <p className="kicker flex items-center gap-3">
                    <span className="h-px w-10 bg-plum-bright" />
                    {hero.kicker}
                  </p>
                </Reveal>
                <Reveal delay={120}>
                  <h1 className="mt-7 font-display text-[13.5vw] font-medium leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.6rem]">
                    <Rich text={hero.title} />
                  </h1>
                </Reveal>
                <Reveal delay={240}>
                  <p className="mt-8 max-w-xl whitespace-pre-line text-base leading-relaxed text-zinc-500 lg:text-lg">{hero.text}</p>
                </Reveal>
                <Reveal delay={360}>
                  <div className="mt-10 flex flex-wrap items-center gap-4">
                    {hero.cta1Label && (
                      <Href href={hero.cta1Href} className="btn-primary">
                        <CalendarDays size={16} />
                        {hero.cta1Label}
                      </Href>
                    )}
                    {hero.cta2Label && (
                      <Href href={hero.cta2Href} className="btn-ghost">
                        {hero.cta2Label}
                        <ArrowRight size={16} />
                      </Href>
                    )}
                  </div>
                </Reveal>
                {hero.stats.length > 0 && (
                  <Reveal delay={480}>
                    <div className="mt-14 flex flex-wrap items-center gap-8 border-t border-zinc-200 pt-7">
                      {hero.stats.map((st, i) => (
                        <div key={i}>
                          <p className="font-display text-3xl font-semibold text-zinc-950">{st.value}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{st.label}</p>
                        </div>
                      ))}
                    </div>
                  </Reveal>
                )}
              </div>
              <Reveal delay={200} className="relative hidden lg:block">
                <div className="absolute -inset-4 -rotate-2 rounded-[2rem] border border-plum/40" />
                <div className="relative overflow-hidden rounded-[1.8rem] border border-zinc-200">
                  <SiteImg src={hero.image} alt={hero.imageName} width={760} height={980} priority className="h-[620px] w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
                    <div>
                      <p className="font-display text-2xl italic">{hero.imageName}</p>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/75">{hero.imageRole}</p>
                    </div>
                    <Sparkles className="text-white" size={22} />
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        ),

        /* ----------------------------- FAIXA ------------------------------ */
        marquee: () =>
          marquee.items.length > 0 && (
            <div className="relative overflow-hidden border-y border-zinc-200 bg-plum/[0.07] py-4">
              <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
                {[...marquee.items, ...marquee.items].map((item, i) => (
                  <span key={i} className="flex items-center gap-10 font-display text-lg italic text-plum/90">
                    {item}
                    <Sparkles size={13} className="text-plum" />
                  </span>
                ))}
              </div>
            </div>
          ),

        /* ----------------------------- SERVIÇOS ---------------------------- */
        services: () => (
          <section className="bg-white py-24 lg:py-32">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <p className="kicker-dark">{services.kicker}</p>
                    <h2 className="mt-5 max-w-xl font-display text-4xl font-medium leading-tight tracking-tight text-zinc-950 lg:text-6xl">
                      <Rich text={services.title} />
                    </h2>
                  </div>
                  {services.ctaLabel && (
                    <Href href={services.ctaHref} className="btn-light">
                      {services.ctaLabel}
                      <ArrowUpRight size={16} />
                    </Href>
                  )}
                </div>
              </Reveal>
              <div className="mt-16 grid gap-6 lg:grid-cols-3">
                {services.items.map((sv, i) => (
                  <Reveal key={i} delay={i * 120}>
                    <Href
                      href={sv.href}
                      className="group flex h-full flex-col rounded-3xl border border-zinc-200 bg-zinc-50 p-8 transition-all duration-500 hover:-translate-y-2 hover:border-plum/50 hover:bg-white hover:shadow-[0_24px_60px_-20px_rgba(128,0,128,0.25)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm italic text-plum">{sv.n}</span>
                        <SiteIcon name={sv.icon} size={22} className="text-zinc-500 transition-colors group-hover:text-plum" />
                      </div>
                      <h3 className="mt-8 font-display text-3xl font-medium text-zinc-950">{sv.title}</h3>
                      <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-600">{sv.desc}</p>
                      {sv.cta && (
                        <span className="mt-8 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-950 transition-colors group-hover:text-plum">
                          {sv.cta}
                          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </span>
                      )}
                    </Href>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),

        /* ------------------------------ MÉTODO ----------------------------- */
        method: () => (
          <section className="grain relative bg-white py-24 text-zinc-950 lg:py-32">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker">{method.kicker}</p>
                <h2 className="mt-5 max-w-2xl font-display text-4xl font-medium leading-tight tracking-tight lg:text-6xl">
                  <Rich text={method.title} />
                </h2>
              </Reveal>
              <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-200/70 sm:grid-cols-2 lg:grid-cols-4">
                {method.items.map((m, i) => (
                  <Reveal key={i} delay={i * 100} className="h-full">
                    <div className="flex h-full flex-col bg-white p-8 transition-colors duration-500 hover:bg-plum/[0.06]">
                      <span className="font-display text-4xl italic text-plum">{m.n}</span>
                      <h3 className="mt-6 font-display text-2xl">{m.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-500">{m.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),

        /* --------------------------- DEPOIMENTOS --------------------------- */
        testimonials: () => (
          <section className="bg-zinc-50 py-24 lg:py-32">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker-dark">{testimonials.kicker}</p>
                <h2 className="mt-5 font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-6xl">
                  <Rich text={testimonials.title} />
                </h2>
              </Reveal>
              <div className="mt-16 grid gap-6 lg:grid-cols-3">
                {testimonials.items.map((tm, i) => (
                  <Reveal key={i} delay={i * 120}>
                    <figure className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-8">
                      <Quote size={26} className="text-plum" fill="currentColor" />
                      <blockquote className="mt-6 flex-1 font-display text-lg italic leading-relaxed text-zinc-800">“{tm.quote}”</blockquote>
                      <figcaption className="mt-8 border-t border-zinc-100 pt-5">
                        <p className="text-sm font-bold text-zinc-950">{tm.name}</p>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-zinc-500">{tm.role}</p>
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ),

        /* -------------------------- CURSO DESTAQUE ------------------------- */
        featured: () => (
          <section className="grain relative overflow-hidden bg-white py-24 text-zinc-950 lg:py-32">
            <div className="glow-plum pointer-events-none absolute right-0 top-0 h-[500px] w-[500px]" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
              <Reveal>
                <div className="relative">
                  <div className="absolute -inset-3 rotate-2 rounded-[2rem] border border-plum/40" />
                  <SiteImg src={featured.image} alt={featured.title.replace(/\*/g, "")} width={800} height={600} className="relative h-[420px] w-full rounded-[1.8rem] border border-zinc-200 object-cover" />
                </div>
              </Reveal>
              <Reveal delay={150}>
                <p className="kicker">{featured.kicker}</p>
                <h2 className="mt-5 font-display text-4xl font-medium leading-tight tracking-tight lg:text-5xl">
                  <Rich text={featured.title} />
                </h2>
                <p className="mt-6 max-w-lg whitespace-pre-line leading-relaxed text-zinc-500">{featured.text}</p>
                <ul className="mt-8 space-y-3">
                  {featured.bullets.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-600">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-plum/30">
                        <Check size={12} className="text-plum" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {featured.ctaLabel && (
                  <div className="mt-10 flex flex-wrap gap-4">
                    <Href href={featured.ctaHref} className="btn-primary">
                      {featured.ctaLabel}
                      <ArrowRight size={16} />
                    </Href>
                  </div>
                )}
              </Reveal>
            </div>
          </section>
        ),

        /* ----------------------------- NEWSLETTER -------------------------- */
        newsletter: () => (
          <section className="relative overflow-hidden bg-plum py-20 text-white">
            <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-2 lg:px-8">
              <Reveal>
                <h2 className="font-display text-3xl font-medium leading-tight lg:text-5xl">
                  <Rich text={newsletter.title} em="italic" />
                </h2>
                <p className="mt-4 max-w-md whitespace-pre-line text-sm leading-relaxed text-white/80">{newsletter.text}</p>
              </Reveal>
              <Reveal delay={150}>
                {ok === "1" ? (
                  <div className="rounded-2xl border border-white/30 bg-white/10 p-6 text-sm">
                    <p className="font-semibold">{newsletter.successTitle}</p>
                    <p className="mt-1 text-white/80">{newsletter.successText}</p>
                  </div>
                ) : (
                  <form action={submitLead} className="flex flex-col gap-3 sm:flex-row">
                    <input type="hidden" name="tag" value="Newsletter — O Dossiê" />
                    <input type="hidden" name="redirectTo" value="/?ok=1" />
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                    <input type="hidden" name="phone" value="" />
                    <input name="name" required placeholder="O seu nome" className="field !border-white !py-3 focus:!ring-white/40" />
                    <input name="email" type="email" required placeholder="O seu melhor email" className="field !border-white !py-3 focus:!ring-white/40" />
                    <button
                      type="submit"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-7 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-plum-ink"
                    >
                      {newsletter.button}
                      <ArrowRight size={15} />
                    </button>
                  </form>
                )}
              </Reveal>
            </div>
          </section>
        ),

        /* ------------------------------ CTA FINAL -------------------------- */
        cta: () => (
          <section className="grain relative bg-white py-28 text-center text-zinc-950 lg:py-36">
            <div className="mx-auto max-w-4xl px-5">
              <Reveal>
                <h2 className="font-display text-5xl font-medium leading-[1.05] tracking-tight lg:text-7xl">
                  <Rich text={cta.title} />
                </h2>
                <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-zinc-500">{cta.text}</p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  {cta.cta1Label && (
                    <Href href={cta.cta1Href} className="btn-primary">
                      <CalendarDays size={16} />
                      {cta.cta1Label}
                    </Href>
                  )}
                  {cta.cta2Label && (
                    <Href href={cta.cta2Href} className="btn-ghost">
                      {cta.cta2Label}
                    </Href>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        ),
      }}
    />
  );
}
