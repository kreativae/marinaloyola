import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  MonitorPlay,
  Quote,
  Sparkles,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/site";
import { submitLead } from "@/lib/actions";

const MARQUEE = [
  "Mentoria 1:1",
  "Identidade Visual",
  "Branding",
  "Posicionamento Premium",
  "Workshops ao vivo",
  "Cursos Online",
  "Portfólio",
  "Design de Marca",
];

const SERVICES = [
  {
    n: "01",
    title: "Mentoria 1:1",
    desc: "Doze semanas de acompanhamento próximo para redesenhar o seu posicionamento, portfólio e preços — com sessões semanais e suporte direto no WhatsApp.",
    href: "/mentoria",
    cta: "Conhecer a mentoria",
    icon: Users,
  },
  {
    n: "02",
    title: "Workshops ao vivo",
    desc: "Sessões intensivas e práticas sobre identidade visual, branding e apresentação de projetos. Vagas limitadas, trabalho real, feedback direto.",
    href: "/cursos",
    cta: "Ver próximos workshops",
    icon: Sparkles,
  },
  {
    n: "03",
    title: "Cursos online",
    desc: "Programas gravados para fazer ao seu ritmo, com módulos, materiais de apoio, quizzes e certificado de conclusão na área de aluna.",
    href: "/cursos",
    cta: "Explorar cursos",
    icon: MonitorPlay,
  },
];

const METHOD = [
  {
    n: "I",
    title: "Diagnóstico",
    desc: "Auditoria honesta da sua marca, do seu portfólio e do modelo de negócio atual.",
  },
  {
    n: "II",
    title: "Identidade",
    desc: "Uma linguagem visual com assinatura própria: tipografia, cor, ritmo e detalhe.",
  },
  {
    n: "III",
    title: "Posicionamento",
    desc: "Nicho, mensagem e preços premium. O mercado passa a perceber o seu valor.",
  },
  {
    n: "IV",
    title: "Expansão",
    desc: "Rotinas de marketing e vendas com consistência — o crescimento deixa de ser acaso.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Em três meses dupliquei o valor dos meus projetos. A Marina não ensina só design — ensina a pensar o negócio com elegância.",
    name: "Sofia Andrade",
    role: "Designer · Lisboa",
  },
  {
    quote:
      "O workshop de identidade visual mudou completamente a forma como apresento propostas. Passei a ser escolhida pelo valor, não pelo preço.",
    name: "Inês Marques",
    role: "Fundadora · Estúdio Meridional",
  },
  {
    quote:
      "A mentoria é cirúrgica. Cada sessão termina com decisões claras. O meu posicionamento nunca foi tão sólido — e tão meu.",
    name: "Beatriz Lemos",
    role: "Brand Designer · Porto",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;

  return (
    <>
      {/* ------------------------------- HERO ------------------------------ */}
      <section className="grain relative overflow-hidden bg-white text-zinc-950">
        <div className="glow-plum pointer-events-none absolute -left-40 top-10 h-[560px] w-[560px]" />
        <div className="glow-plum pointer-events-none absolute -right-52 bottom-0 h-[620px] w-[620px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-32 lg:pt-24">
          <div>
            <Reveal>
              <p className="kicker flex items-center gap-3">
                <span className="h-px w-10 bg-plum-bright" />
                Mentoria · Workshops · Cursos online
              </p>
            </Reveal>
            <Reveal delay={120}>
              <h1 className="mt-7 font-display text-[13.5vw] font-medium leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.6rem]">
                Design com
                <br />
                assinatura.
                <br />
                <span className="italic text-plum">Negócio com alma.</span>
              </h1>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-8 max-w-xl text-base leading-relaxed text-zinc-500 lg:text-lg">
                Ajudo designers ambiciosas a transformar talento em posicionamento
                premium — marcas que cobram o que valem, com elegância, método e
                estratégia.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/agendar" className="btn-primary">
                  <CalendarDays size={16} />
                  Agendar sessão exploratória
                </Link>
                <Link href="/mentoria" className="btn-ghost">
                  Conhecer a mentoria
                  <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={480}>
              <div className="mt-14 flex items-center gap-8 border-t border-zinc-200 pt-7">
                {[
                  ["12+", "anos de estúdio"],
                  ["400+", "alunas mentoradas"],
                  ["97%", "de satisfação"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-display text-3xl font-semibold text-zinc-950">{v}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {l}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={200} className="relative hidden lg:block">
            <div className="absolute -inset-4 -rotate-2 rounded-[2rem] border border-plum/40" />
            <div className="relative overflow-hidden rounded-[1.8rem] border border-zinc-200">
              <Image
                src="/img/marina-hero.jpg"
                alt="Marina Loyola — Designer e Mentora"
                width={760}
                height={980}
                priority
                className="h-[620px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
                <div>
                  <p className="font-display text-2xl italic">Marina Loyola</p>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/75">
                    Designer · Mentora · Lisboa
                  </p>
                </div>
                <Sparkles className="text-white" size={22} />
              </div>
            </div>
          </Reveal>
        </div>

        {/* marquee */}
        <div className="relative border-y border-zinc-200 bg-plum/[0.07] py-4">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-10 font-display text-lg italic text-plum/90"
              >
                {item}
                <Sparkles size={13} className="text-plum" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- SERVIÇOS ---------------------------- */}
      <section className="bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="kicker-dark">Como posso ajudar</p>
                <h2 className="mt-5 max-w-xl font-display text-4xl font-medium leading-tight tracking-tight text-zinc-950 lg:text-6xl">
                  Três caminhos, um só destino:{" "}
                  <span className="italic text-plum">o seu próximo nível.</span>
                </h2>
              </div>
              <Link href="/contato" className="btn-light">
                Falar comigo
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </Reveal>
          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <Link
                  href={s.href}
                  className="group flex h-full flex-col rounded-3xl border border-zinc-200 bg-zinc-50 p-8 transition-all duration-500 hover:-translate-y-2 hover:border-plum/50 hover:bg-white hover:shadow-[0_24px_60px_-20px_rgba(128,0,128,0.25)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm italic text-plum">{s.n}</span>
                    <s.icon
                      size={22}
                      className="text-zinc-500 transition-colors group-hover:text-plum"
                    />
                  </div>
                  <h3 className="mt-8 font-display text-3xl font-medium text-zinc-950">
                    {s.title}
                  </h3>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-600">{s.desc}</p>
                  <span className="mt-8 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-950 transition-colors group-hover:text-plum">
                    {s.cta}
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ MÉTODO ----------------------------- */}
      <section className="grain relative bg-white py-24 text-zinc-950 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker">O método</p>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-medium leading-tight tracking-tight lg:text-6xl">
              Um percurso desenhado como uma{" "}
              <span className="italic text-plum">boa grelha tipográfica.</span>
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-200/70 sm:grid-cols-2 lg:grid-cols-4">
            {METHOD.map((m, i) => (
              <Reveal key={m.n} delay={i * 100} className="h-full">
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

      {/* --------------------------- DEPOIMENTOS --------------------------- */}
      <section className="bg-zinc-50 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker-dark">Vozes de quem passou por aqui</p>
            <h2 className="mt-5 font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-6xl">
              Resultados com <span className="italic text-plum">assinatura.</span>
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <figure className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-8">
                  <Quote size={26} className="text-plum" fill="currentColor" />
                  <blockquote className="mt-6 flex-1 font-display text-lg italic leading-relaxed text-zinc-800">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-8 border-t border-zinc-100 pt-5">
                    <p className="text-sm font-bold text-zinc-950">{t.name}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {t.role}
                    </p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------- CURSO DESTAQUE ------------------------- */}
      <section className="grain relative overflow-hidden bg-white py-24 text-zinc-950 lg:py-32">
        <div className="glow-plum pointer-events-none absolute right-0 top-0 h-[500px] w-[500px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <div className="relative">
              <div className="absolute -inset-3 rotate-2 rounded-[2rem] border border-plum/40" />
              <Image
                src="/img/curso-marca.jpg"
                alt="Curso Identidade com Assinatura"
                width={800}
                height={600}
                className="relative h-[420px] w-full rounded-[1.8rem] border border-zinc-200 object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={150}>
            <p className="kicker">Curso em destaque</p>
            <h2 className="mt-5 font-display text-4xl font-medium leading-tight tracking-tight lg:text-5xl">
              Identidade com <span className="italic text-plum">Assinatura</span>
            </h2>
            <p className="mt-6 max-w-lg leading-relaxed text-zinc-500">
              O programa completo para construir identidades visuais premium — da
              estratégia à apresentação final — com o método que uso há 12 anos no
              estúdio.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "3 módulos · 9 aulas em vídeo",
                "Materiais, templates e exercícios",
                "Quiz por módulo e certificado de conclusão",
                "Acesso imediato na área de aluna após a compra",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-zinc-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-plum/30">
                    <Check size={12} className="text-plum" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/cursos" className="btn-primary">
                Ver cursos e inscrições
                <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- NEWSLETTER -------------------------- */}
      <section className="relative overflow-hidden bg-plum py-20 text-white">
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <h2 className="font-display text-3xl font-medium leading-tight lg:text-5xl">
              O Dossiê — <span className="italic">cartas sobre design e negócio.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Receba o guia gratuito “5 erros que tornam o seu portfólio invisível” e, a
              cada duas semanas, uma carta com bastidores, método e estratégia.
            </p>
          </Reveal>
          <Reveal delay={150}>
            {ok === "1" ? (
              <div className="rounded-2xl border border-white/30 bg-white/10 p-6 text-sm">
                <p className="font-semibold">Inscrição confirmada.</p>
                <p className="mt-1 text-white/80">
                  Verifique o seu email — o guia está a caminho. Obrigada por estar
                  desse lado.
                </p>
              </div>
            ) : (
              <form action={submitLead} className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="tag" value="Newsletter — O Dossiê" />
                <input type="hidden" name="redirectTo" value="/?ok=1" />
                <input type="hidden" name="phone" value="" />
                <input
                  name="name"
                  required
                  placeholder="O seu nome"
                  className="field !border-white !py-3 focus:!ring-white/40"
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="O seu melhor email"
                  className="field !border-white !py-3 focus:!ring-white/40"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-7 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-plum-ink"
                >
                  Quero receber
                  <ArrowRight size={15} />
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ CTA FINAL -------------------------- */}
      <section className="grain relative bg-white py-28 text-center text-zinc-950 lg:py-36">
        <div className="mx-auto max-w-4xl px-5">
          <Reveal>
            <h2 className="font-display text-5xl font-medium leading-[1.05] tracking-tight lg:text-7xl">
              Pronta para desenhar o{" "}
              <span className="italic text-plum">próximo capítulo?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-zinc-500">
              Agende uma sessão exploratória gratuita de 30 minutos. Sem compromisso —
              apenas clareza sobre o seu caminho.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/agendar" className="btn-primary">
                <CalendarDays size={16} />
                Agendar agora
              </Link>
              <Link href="/cursos" className="btn-ghost">
                Explorar cursos
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
