import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { Reveal } from "@/components/site";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const metadata: Metadata = {
  title: "Mentoria 1:1",
  description:
    "Mentoria individual de 12 semanas para designers: posicionamento, portfólio, preços premium e um negócio criativo sustentável.",
};

const FOR_WHOM = [
  "Designers freelancers que querem cobrar mais e escolher melhor os clientes",
  "Profissionais em transição para branding e identidade visual",
  "Fundadoras de estúdio que precisam de posicionamento e processo",
  "Quem sente que o talento já lá está — falta a estratégia",
];

const PROGRAM = [
  {
    phase: "Semanas 1–3",
    title: "Diagnóstico & Fundação",
    text: "Auditoria completa do seu negócio criativo: portfólio, preços, clientes e mensagem. Definimos o destino.",
  },
  {
    phase: "Semanas 4–6",
    title: "Identidade & Assinatura",
    text: "A sua linguagem visual e editorial refinada até ser inconfundível. Do moodboard à apresentação.",
  },
  {
    phase: "Semanas 7–9",
    title: "Posicionamento & Preço",
    text: "Nicho, proposta de valor e tabela de preços premium. Aprende a dizer o valor sem hesitar.",
  },
  {
    phase: "Semanas 10–12",
    title: "Vendas & Expansão",
    text: "Rotinas de marketing, scripts de proposta e um plano de 90 dias para crescer com consistência.",
  },
];

const FAQ = [
  {
    q: "Como funcionam as sessões?",
    a: "Sessões semanais de 60 minutos via Zoom, com gravação e notas partilhadas. Entre sessões, tem acesso direto a mim via WhatsApp para dúvidas e feedback.",
  },
  {
    q: "Qual é o investimento?",
    a: "O programa completo de 12 semanas tem o valor de 1.800€, com possibilidade de pagamento faseado em 3x. Em Portugal aceito transferência ou MBWay; fora de Portugal, via Hotmart em qualquer moeda.",
  },
  {
    q: "E se não for o momento certo?",
    a: "A sessão exploratória existe exatamente para isso: 30 minutos gratuitos para percebermos juntas se a mentoria é o próximo passo certo para si.",
  },
  {
    q: "Quantas vagas existem?",
    a: "A trabalhar apenas com 6 mentorandas em simultâneo, para garantir profundidade real em cada acompanhamento.",
  },
];

async function whatsappNumber() {
  try {
    const rows = await db.select().from(settings);
    return rows.find((r) => r.key === "whatsapp_number")?.value || "351912345678";
  } catch {
    return "351912345678";
  }
}

export default async function MentoriaPage() {
  const wa = await whatsappNumber();
  const waLink = `https://wa.me/${wa}?text=${encodeURIComponent(
    "Olá Marina! Quero candidatar-me à Mentoria Design Business."
  )}`;

  return (
    <>
      <section className="grain relative overflow-hidden bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
        <div className="glow-plum pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker flex items-center gap-3">
              <span className="h-px w-10 bg-plum-bright" /> Mentoria 1:1 · 12 semanas
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
              Mentoria <span className="italic text-plum">Design Business</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-500">
              Três meses de acompanhamento individual para transformar a sua prática de
              design num negócio premium, sustentável e com assinatura própria.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary">
                <MessageCircle size={16} />
                Candidatar via WhatsApp
              </a>
              <Link href="/agendar" className="btn-ghost">
                <CalendarDays size={16} />
                Sessão exploratória gratuita
              </Link>
            </div>
          </Reveal>

          <div className="mt-20 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:p-10">
                <h2 className="font-display text-2xl italic text-plum">Para quem é</h2>
                <ul className="mt-7 space-y-4">
                  {FOR_WHOM.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-600">
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
                <h2 className="font-display text-2xl italic">O formato</h2>
                <ul className="mt-7 space-y-4 text-sm leading-relaxed text-zinc-600">
                  {[
                    "12 sessões individuais de 60 minutos via Zoom",
                    "Suporte direto no WhatsApp entre sessões",
                    "Templates, scripts e materiais de trabalho",
                    "Plano de 90 dias desenhado consigo",
                    "Apenas 6 vagas em simultâneo",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200/70">
                        <Check size={12} className="text-plum" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 border-t border-zinc-200 pt-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                    Investimento
                  </p>
                  <p className="mt-2 font-display text-5xl font-semibold">
                    1.800€
                    <span className="ml-2 align-middle text-sm font-normal text-zinc-500">
                      ou 3 × 620€
                    </span>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker-dark">O programa</p>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-5xl">
              Doze semanas, <span className="italic text-plum">quatro movimentos.</span>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {PROGRAM.map((p, i) => (
              <Reveal key={p.phase} delay={i * 90}>
                <div className="group h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-8 transition-all duration-500 hover:border-plum/50 hover:bg-white hover:shadow-[0_24px_60px_-24px_rgba(128,0,128,0.3)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-plum">
                    {p.phase}
                  </p>
                  <h3 className="mt-4 font-display text-2xl text-zinc-950">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 py-24 lg:py-28">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker-dark">Perguntas frequentes</p>
            <h2 className="mt-5 font-display text-4xl font-medium tracking-tight text-zinc-950">
              Antes de dizer <span className="italic text-plum">sim.</span>
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="group rounded-2xl border border-zinc-200 bg-white p-6 open:border-plum/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg text-zinc-950">
                    {f.q}
                    <ArrowUpRight
                      size={18}
                      className="shrink-0 text-plum transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-600">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="mt-12 rounded-3xl border border-plum/15 bg-plum/[0.05] p-10 text-center text-zinc-950">
              <h3 className="font-display text-3xl italic">
                A próxima vaga pode ser <span className="text-plum">a sua.</span>
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600">
                Comece com uma sessão exploratória gratuita e saia com clareza — tenha ou
                não lugar na mentoria.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-4">
                <Link href="/agendar" className="btn-primary">
                  <CalendarDays size={16} /> Agendar sessão
                </Link>
                <a href={waLink} target="_blank" rel="noreferrer" className="btn-ghost">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
