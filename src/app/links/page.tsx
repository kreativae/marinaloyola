import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, Globe, Mail, MessageCircle, Sparkles } from "lucide-react";
import { db } from "@/db";
import { bioEvents } from "@/db/schema";
import { submitLead } from "@/lib/actions";
import { activeLinks, getBioConfig, nextBookingDays, publishedCourses } from "@/lib/bio";
import { cn, eur } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getBioConfig();
  return {
    title: { absolute: `${cfg.bio_name} · Links` },
    description: cfg.bio_tagline,
    openGraph: { title: cfg.bio_name, description: cfg.bio_tagline, images: [cfg.bio_photo] },
  };
}

/** Glifo simples de câmara (o lucide já não inclui ícones de marcas). */
function InstagramGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const go = (target: string, preview: boolean) => `/links/ir/${target}${preview ? "?preview=1" : ""}`;

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; inscrito?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const preview = sp.preview === "1";
  const [cfg, links, courseList, booking] = await Promise.all([getBioConfig(), activeLinks(), publishedCourses(), nextBookingDays()]);
  // Conta a visita (o pré-visualizador do backoffice não conta)
  if (!preview) await db.insert(bioEvents).values({ kind: "view" }).catch(() => undefined);

  const dayChip = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const wd = d.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "").slice(0, 3);
    const mon = d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "");
    return { wd, day: d.getDate(), mon };
  };
  const socials = [
    { target: "instagram", label: "Instagram", icon: <InstagramGlyph /> },
    { target: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={18} /> },
    { target: "email", label: "Email", icon: <Mail size={18} /> },
    { target: "site", label: "Site", icon: <Globe size={18} /> },
  ];
  let i = 0;
  const delay = () => ({ animationDelay: `${120 + i++ * 70}ms` });

  return (
    <div className="min-h-dvh bg-[#140a14] text-white selection:bg-plum-soft selection:text-[#140a14]">
      {/* Retrato: faixa no topo (telemóvel) ou metade direita fixa (computador) */}
      <div className="pointer-events-none fixed inset-y-0 right-0 hidden w-1/2 lg:block">
        <Image src={cfg.bio_photo} alt="" fill priority sizes="50vw" className="object-cover object-top opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#140a14,transparent_35%)]" />
      </div>

      <main className="relative lg:w-1/2">
        <div className="relative h-60 overflow-hidden lg:hidden">
          <Image src={cfg.bio_photo} alt="" fill priority sizes="100vw" className="object-cover object-[50%_20%] opacity-80" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_30%,#140a14)]" />
        </div>

        <div className="mx-auto w-full max-w-[460px] px-5 pb-16 max-lg:-mt-20 lg:pt-16">
          {/* Perfil */}
          <header className="relative text-center animate-[rise_0.7s_var(--ease-out-soft)_backwards]">
            <span className="relative mx-auto block h-24 w-24 overflow-hidden rounded-full ring-2 ring-plum-soft/60 ring-offset-4 ring-offset-[#140a14]">
              <Image src={cfg.bio_photo} alt={cfg.bio_name} fill sizes="96px" className="object-cover object-top" />
            </span>
            <h1 className="mt-5 font-display text-[2rem] font-medium italic leading-none tracking-[-0.01em]">{cfg.bio_name}</h1>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-plum-soft">{cfg.bio_tagline}</p>
            {cfg.bio_about && <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/65">{cfg.bio_about}</p>}
            <nav className="mt-5 flex justify-center gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.target}
                  href={go(s.target, preview)}
                  target={s.target === "site" ? undefined : "_blank"}
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-plum-soft hover:bg-plum-soft/10 hover:text-white"
                >
                  {s.icon}
                </a>
              ))}
            </nav>
          </header>

          <div className="mt-9 space-y-3.5">
            {/* Agendar */}
            {cfg.bio_show_booking === "1" && booking.type && (
              <section
                className="overflow-hidden rounded-[22px] bg-plum p-5 shadow-[0_24px_50px_-20px_rgb(168_85_247/0.55)] animate-[rise_0.7s_var(--ease-out-soft)_backwards]"
                style={delay()}
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <CalendarDays size={20} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-medium leading-tight">{cfg.bio_booking_title}</h2>
                    <p className="mt-1 text-[13px] leading-snug text-white/75">{cfg.bio_booking_subtitle}</p>
                  </div>
                </div>
                {booking.days.length > 0 && (
                  <>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">Próximas vagas</p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {booking.days.map((d) => {
                        const c = dayChip(d.iso);
                        return (
                          <a
                            key={d.iso}
                            href={go(`agendar-${booking.type!.id}-${d.iso}`, preview)}
                            className="flex flex-col items-center rounded-2xl bg-white/10 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-plum"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{c.wd}</span>
                            <span className="font-display text-xl font-semibold leading-tight">{c.day}</span>
                            <span className="text-[10px] uppercase opacity-70">{c.mon}</span>
                          </a>
                        );
                      })}
                    </div>
                  </>
                )}
                <a
                  href={go("agendar", preview)}
                  className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-plum transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Ver todos os horários <ArrowUpRight size={15} />
                </a>
              </section>
            )}

            {/* Links personalizados */}
            {links.map((l) =>
              l.image ? (
                <a
                  key={l.id}
                  href={go(`l${l.id}`, preview)}
                  target={l.url.startsWith("/") ? undefined : "_blank"}
                  rel="noreferrer"
                  className="group relative block h-36 overflow-hidden rounded-[22px] ring-1 ring-white/10 transition-all duration-500 hover:-translate-y-0.5 hover:ring-plum-soft/60 animate-[rise_0.7s_var(--ease-out-soft)_backwards]"
                  style={delay()}
                >
                  <Image src={l.image} alt="" fill sizes="460px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(20_10_20/0.92)_35%,rgb(20_10_20/0.2))]" />
                  <div className="relative flex h-full flex-col justify-center p-5 pr-24">
                    {l.highlight && (
                      <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-plum-soft/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-plum-soft">
                        <Sparkles size={11} /> Destaque
                      </span>
                    )}
                    <p className="font-display text-lg font-medium leading-tight">{l.title}</p>
                    {l.subtitle && <p className="mt-1 text-[13px] leading-snug text-white/65">{l.subtitle}</p>}
                  </div>
                  <ArrowUpRight size={18} className="absolute right-5 top-5 text-white/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </a>
              ) : (
                <a
                  key={l.id}
                  href={go(`l${l.id}`, preview)}
                  target={l.url.startsWith("/") ? undefined : "_blank"}
                  rel="noreferrer"
                  className={cn(
                    "group flex items-center gap-3 rounded-[22px] border px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 animate-[rise_0.7s_var(--ease-out-soft)_backwards]",
                    l.highlight
                      ? "border-plum-soft/50 bg-plum-soft/10 hover:bg-plum-soft/20"
                      : "border-white/12 bg-white/[0.05] hover:border-white/25 hover:bg-white/[0.09]"
                  )}
                  style={delay()}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{l.title}</span>
                    {l.subtitle && <span className="mt-0.5 block text-[13px] text-white/60">{l.subtitle}</span>}
                  </span>
                  <ArrowUpRight size={17} className="shrink-0 text-white/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </a>
              )
            )}

            {/* Cursos */}
            {cfg.bio_show_courses === "1" && courseList.length > 0 && (
              <section className="pt-4 animate-[rise_0.7s_var(--ease-out-soft)_backwards]" style={delay()}>
                <h2 className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.32em] text-white/50">
                  <span className="h-px flex-1 bg-white/10" /> Cursos & programas <span className="h-px flex-1 bg-white/10" />
                </h2>
                <div className="space-y-2.5">
                  {courseList.map((c) => (
                    <a
                      key={c.id}
                      href={go(`c${c.id}`, preview)}
                      target={c.hotmartUrl ? "_blank" : undefined}
                      rel="noreferrer"
                      className="group flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-2.5 pr-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08]"
                    >
                      <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-plum/30">
                        {c.cover && <Image src={c.cover} alt="" fill sizes="72px" className="object-cover transition-transform duration-500 group-hover:scale-110" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-plum-soft">{c.subtitle ?? c.level}</span>
                        <span className="mt-0.5 line-clamp-2 block font-semibold leading-snug">{c.title}</span>
                        <span className="mt-0.5 block text-[13px] text-white/55">{Number(c.price) > 0 ? eur(c.price) : "Gratuito"}</span>
                      </span>
                      <ArrowUpRight size={17} className="shrink-0 text-white/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Newsletter */}
            {cfg.bio_show_newsletter === "1" && (
              <section
                id="newsletter"
                className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-5 animate-[rise_0.7s_var(--ease-out-soft)_backwards]"
                style={delay()}
              >
                <p className="font-display text-xl font-medium italic">O Dossiê</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  A newsletter quinzenal com bastidores, preços e estratégia para designers.
                </p>
                {sp.inscrito ? (
                  <p className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                    <Check size={16} /> Inscrição feita. Até já na tua caixa de email!
                  </p>
                ) : (
                  <form action={submitLead} className="mt-4 space-y-2">
                    <input type="hidden" name="tag" value="Newsletter — O Dossiê" />
                    <input type="hidden" name="redirectTo" value="/links?inscrito=1#newsletter" />
                    <input type="hidden" name="message" value="Inscreveu-se na newsletter pela página de links." />
                    <div className="flex gap-2">
                      <input
                        name="name"
                        required
                        placeholder="Nome"
                        className="w-2/5 min-w-0 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-plum-soft"
                      />
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="Email"
                        className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-plum-soft"
                      />
                    </div>
                    <button type="submit" className="w-full rounded-full bg-white py-2.5 text-sm font-semibold text-[#140a14] transition-transform hover:scale-[1.01] active:scale-[0.98]">
                      Quero receber
                    </button>
                    {sp.erro && <p className="text-xs text-rose-300">Indique o nome e o email.</p>}
                  </form>
                )}
              </section>
            )}
          </div>

          <footer className="mt-12 text-center text-[11px] text-white/35">
            <a href={go("site", preview)} className="font-display text-base italic text-white/60 transition-colors hover:text-white">
              marinaloyola.com
            </a>
            <p className="mt-1">© {new Date().getFullYear()} {cfg.bio_name}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
