import { Reveal } from "@/components/site";
import { Rich, Sections } from "@/components/site-text";
import { getSitePage, siteMetadata } from "@/lib/site-content";

export const generateMetadata = () => siteMetadata("legal");

function Clauses({ id, title, items }: { id: string; title: string; items: { t: string; p: string }[] }) {
  return (
    <section className="bg-white pb-12">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <Reveal>
          <h2 id={id} className="mt-4 scroll-mt-28 font-display text-3xl italic text-plum">
            {title}
          </h2>
          <div className="mt-8 space-y-8">
            {items.map((s, i) => (
              <div key={i}>
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-950">{s.t}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-500">{s.p}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default async function LegalPage() {
  const page = await getSitePage("legal");
  const { intro, privacy, terms } = page.s;

  return (
    <div className="pb-12">
      <Sections
        page={page}
        blocks={{
          intro: () => (
            <section className="bg-white pb-12 pt-16 text-zinc-950 lg:pt-24">
              <div className="mx-auto max-w-3xl px-5 lg:px-8">
                <Reveal>
                  <p className="kicker flex items-center gap-3">
                    <span className="h-px w-10 bg-plum-bright" /> {intro.kicker}
                  </p>
                  <h1 className="mt-6 font-display text-5xl font-medium tracking-tight lg:text-6xl">
                    <Rich text={intro.title} />
                  </h1>
                  <p className="mt-5 text-sm text-zinc-500">{intro.updated}</p>
                </Reveal>
              </div>
            </section>
          ),
          privacy: () => <Clauses id="privacidade" {...privacy} />,
          terms: () => <Clauses id="termos" {...terms} />,
        }}
      />
    </div>
  );
}
