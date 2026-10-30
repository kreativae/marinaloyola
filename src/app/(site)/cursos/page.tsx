import Image from "next/image";
import { ArrowUpRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { Reveal } from "@/components/site";
import { Href, Rich, Sections } from "@/components/site-text";
import { getSitePage, siteMetadata } from "@/lib/site-content";
import { eur } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const generateMetadata = () => siteMetadata("cursos");

export default async function CursosPage() {
  const [list, page] = await Promise.all([db.select().from(courses).where(eq(courses.published, true)), getSitePage("cursos")]);
  const { hero, list: listText, guarantee, cta } = page.s;

  return (
    <Sections
      page={page}
      blocks={{
        hero: () => (
          <section className="grain relative overflow-hidden bg-white pb-20 pt-16 text-zinc-950 lg:pt-24">
            <div className="glow-plum pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px]" />
            <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <p className="kicker flex items-center gap-3">
                  <span className="h-px w-10 bg-plum-bright" /> {hero.kicker}
                </p>
                <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
                  <Rich text={hero.title} />
                </h1>
                <p className="mt-7 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-zinc-500">{hero.text}</p>
              </Reveal>
            </div>
          </section>
        ),

        list: () => (
          <section className="bg-white pb-8 pt-20 lg:pt-28">
            <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-3 lg:px-8">
              {list.map((c, i) => (
                <Reveal key={c.id} delay={i * 120}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-all duration-500 hover:-translate-y-2 hover:border-plum/50 hover:shadow-[0_28px_70px_-24px_rgba(128,0,128,0.35)]">
                    <div className="relative h-52 overflow-hidden">
                      {c.cover ? (
                        <Image src={c.cover} alt={c.title} fill unoptimized={!c.cover.startsWith("/img/")} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="h-full w-full bg-plum/10" />
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-plum backdrop-blur">{c.level}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-7">
                      <h2 className="font-display text-2xl leading-snug text-zinc-950">{c.title}</h2>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-plum">{c.subtitle}</p>
                      <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-600">{c.description}</p>
                      <div className="mt-6 flex items-end justify-between border-t border-zinc-100 pt-5">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">{listText.priceLabel}</p>
                          <p className="font-display text-3xl font-semibold text-zinc-950">{eur(c.price)}</p>
                        </div>
                        <Sparkles size={18} className="text-plum" />
                      </div>
                      <a href={c.hotmartUrl ?? "https://pay.hotmart.com/"} target="_blank" rel="noreferrer" className="btn-dark mt-6 w-full">
                        {listText.button}
                        <ArrowUpRight size={15} />
                      </a>
                      {listText.note && <p className="mt-3 text-center text-[11px] text-zinc-500">{listText.note}</p>}
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        ),

        guarantee: () => (
          <section className="bg-white py-8">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <div className="grid gap-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:p-10">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-plum text-white">
                    <ShieldCheck size={26} />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl text-zinc-950">{guarantee.title}</h3>
                    <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-zinc-600">{guarantee.text}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-700">
                    {guarantee.bullets.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check size={14} className="text-plum" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </section>
        ),

        cta: () => (
          <section className="bg-white pb-20 pt-8 lg:pb-28">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <Reveal>
                <div className="rounded-3xl border border-plum/15 bg-plum/[0.05] p-10 text-center text-zinc-950 lg:p-14">
                  <h3 className="font-display text-3xl italic lg:text-4xl">
                    <Rich text={cta.title} em="text-plum" />
                  </h3>
                  <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-sm text-zinc-600">{cta.text}</p>
                  {cta.ctaLabel && (
                    <Href href={cta.ctaHref} className="btn-primary mt-7">
                      {cta.ctaLabel}
                      <ArrowUpRight size={15} />
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
