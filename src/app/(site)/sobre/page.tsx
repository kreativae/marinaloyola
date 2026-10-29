import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, CalendarDays, Gem, HeartHandshake, Ruler } from "lucide-react";
import type { Metadata } from "next";
import { Reveal } from "@/components/site";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "A trajetória de Marina Loyola: 12 anos de estúdio, centenas de marcas desenhadas e uma missão — elevar o design português a premium.",
};

const TIMELINE = [
  {
    year: "2013",
    title: "O começo",
    text: "Licenciatura em Design de Comunicação e os primeiros projetos de identidade visual para marcas locais.",
  },
  {
    year: "2016",
    title: "Estúdio próprio",
    text: "Nasce o estúdio Marina Loyola. Primeiros clientes internacionais e a especialização em branding premium.",
  },
  {
    year: "2019",
    title: "A viragem para o ensino",
    text: "Primeira turma de mentoria. Percebo que ensinar designers a valorizar o seu trabalho é a minha missão.",
  },
  {
    year: "2022",
    title: "Workshops e cursos",
    text: "Lançamento dos programas online. Mais de 400 alunas passam pelos cursos e mentorias.",
  },
  {
    year: "2026",
    title: "A plataforma",
    text: "Tudo reunido num só ecossistema: cursos, mentoria, comunidade e acompanhamento personalizado.",
  },
];

const VALUES = [
  {
    icon: Gem,
    title: "Elegância acima do ruído",
    text: "Menos, mas impecável. O bom design é silencioso e impossível de ignorar ao mesmo tempo.",
  },
  {
    icon: Ruler,
    title: "Método antes do talento",
    text: "Intuição treina-se. Processos claros libertam a criatividade em vez de a prender.",
  },
  {
    icon: HeartHandshake,
    title: "Generosidade radical",
    text: "Ensino tudo o que sei, sem reservas. O sucesso das minhas alunas é o meu portfólio.",
  },
  {
    icon: Award,
    title: "Excelência discreta",
    text: "Premium não é arrogância. É consistência, detalhe e respeito pelo ofício.",
  },
];

export default function SobrePage() {
  return (
    <>
      <section className="bg-white pb-0 pt-16 text-zinc-950 lg:pt-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker flex items-center gap-3">
              <span className="h-px w-10 bg-plum-bright" /> Sobre mim
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
              Olá, sou a Marina. Desenho marcas — e{" "}
              <span className="italic text-plum">carreiras.</span>
            </h1>
          </Reveal>
        </div>
        <div className="mx-auto mt-16 grid max-w-7xl items-start gap-14 px-5 pb-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <Reveal>
            <div className="relative">
              <div className="absolute -inset-3 -rotate-2 rounded-[2rem] border border-plum/40" />
              <Image
                src="/img/marina-sobre.jpg"
                alt="O estúdio de Marina Loyola"
                width={800}
                height={640}
                className="relative h-[440px] w-full rounded-[1.8rem] border border-zinc-200 object-cover"
              />
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <p className="font-display text-xl italic leading-relaxed text-zinc-800">
                  “O design é 20% estética e 80% decisões. Eu ensino as decisões.”
                </p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.25em] text-plum">
                  Marina Loyola
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <div className="space-y-5 leading-relaxed text-zinc-500">
              <p className="text-lg text-zinc-800">
                Há 12 anos que desenho identidades visuais para marcas que querem ser
                levadas a sério. Há 7 que ensino outras designers a fazer o mesmo — com
                método, coragem e preços justos.
              </p>
              <p>
                Comecei como tantas de vocês: portfólio improvisado, clientes que
                negociavam cada euro e a sensação permanente de que faltava alguma coisa
                que ninguém ensina na faculdade. Faltava — e não era talento. Era
                posicionamento, processo e apresentação.
              </p>
              <p>
                Depois de centenas de projetos de branding, condensei tudo num método
                próprio que hoje partilho em mentorias individuais, workshops intensivos
                e cursos online. Mais de 400 designers já passaram por estes programas e
                transformaram a relação com o seu trabalho — e com os seus clientes.
              </p>
              <p>
                Acredito num design português que cobra o que vale, que tem assinatura e
                que não pede desculpa pela ambição. Se é isso que procura, estamos no
                mesmo caminho.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/mentoria" className="btn-primary">
                Trabalhar comigo
                <ArrowRight size={16} />
              </Link>
              <Link href="/agendar" className="btn-ghost">
                <CalendarDays size={16} />
                Agendar conversa
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker-dark">Trajetória</p>
            <h2 className="mt-5 font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-5xl">
              Uma década a desenhar <span className="italic text-plum">o essencial.</span>
            </h2>
          </Reveal>
          <div className="mt-14 space-y-0">
            {TIMELINE.map((t, i) => (
              <Reveal key={t.year} delay={i * 80}>
                <div className="group grid gap-2 border-t border-zinc-200 py-8 transition-colors last:border-b hover:bg-zinc-50 sm:grid-cols-[120px_220px_1fr] sm:items-baseline sm:gap-8 sm:px-4">
                  <p className="font-display text-3xl italic text-plum">{t.year}</p>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-950">
                    {t.title}
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-600">{t.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="grain bg-white py-24 text-zinc-950 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="kicker">Valores</p>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-medium tracking-tight lg:text-5xl">
              Aquilo em que acredito — <span className="italic text-plum">e ensino.</span>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 100}>
                <div className="h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-7 transition-colors duration-500 hover:border-plum/50 hover:bg-plum/[0.05]">
                  <v.icon size={24} className="text-plum" />
                  <h3 className="mt-6 font-display text-xl">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
