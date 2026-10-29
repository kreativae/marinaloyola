import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { Reveal } from "@/components/site";
import { eur } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cursos & Workshops",
  description:
    "Cursos online e workshops ao vivo de identidade visual, branding e negócio criativo. Inscrições com pagamento seguro via Hotmart.",
};

export default async function CursosPage() {
  const list = await db.select().from(courses).where(eq(courses.published, true));

  return (
    <>
      <section className="grain relative overflow-hidden bg-white pb-20 pt-16 text-zinc-950 lg:pt-24">
        <div className="glow-plum pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker flex items-center gap-3">
              <span className="h-px w-10 bg-plum-bright" /> Formação
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
              Cursos & <span className="italic text-plum">workshops.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-500">
              Programas desenhados ao milímetro para designers que querem subir de nível —
              com materiais, exercícios, quizzes e certificado, na sua área de aluna.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {list.map((c, i) => (
              <Reveal key={c.id} delay={i * 120}>
                <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-all duration-500 hover:-translate-y-2 hover:border-plum/50 hover:shadow-[0_28px_70px_-24px_rgba(128,0,128,0.35)]">
                  <div className="relative h-52 overflow-hidden">
                    {c.cover ? (
                      <Image
                        src={c.cover}
                        alt={c.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-plum/10" />
                    )}
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-plum backdrop-blur">
                      {c.level}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <h2 className="font-display text-2xl leading-snug text-zinc-950">
                      {c.title}
                    </h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-plum">
                      {c.subtitle}
                    </p>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-600">
                      {c.description}
                    </p>
                    <div className="mt-6 flex items-end justify-between border-t border-zinc-100 pt-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                          Investimento
                        </p>
                        <p className="font-display text-3xl font-semibold text-zinc-950">
                          {eur(c.price)}
                        </p>
                      </div>
                      <Sparkles size={18} className="text-plum" />
                    </div>
                    <a
                      href={c.hotmartUrl ?? "https://pay.hotmart.com/"}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-dark mt-6 w-full"
                    >
                      Inscrever na Hotmart
                      <ArrowUpRight size={15} />
                    </a>
                    <p className="mt-3 text-center text-[11px] text-zinc-500">
                      Pagamento seguro · acesso imediato à área de aluna
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-16 grid gap-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:p-10">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-plum text-white">
                <ShieldCheck size={26} />
              </span>
              <div>
                <h3 className="font-display text-2xl text-zinc-950">
                  Garantia incondicional de 7 dias
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
                  Todos os cursos têm garantia total via Hotmart. Se não for para si,
                  devolvemos o investimento — sem perguntas, sem letras pequenas.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-zinc-700">
                {["Acesso vitalício", "Certificado incluído", "Suporte por email"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check size={14} className="text-plum" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-16 rounded-3xl border border-plum/15 bg-plum/[0.05] p-10 text-center text-zinc-950 lg:p-14">
              <h3 className="font-display text-3xl italic lg:text-4xl">
                Prefere um acompanhamento{" "}
                <span className="text-plum">mais próximo?</span>
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600">
                A mentoria 1:1 é o caminho mais rápido: 12 semanas, sessões semanais e
                um plano desenhado para o seu momento.
              </p>
              <Link href="/mentoria" className="btn-primary mt-7">
                Conhecer a mentoria
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
