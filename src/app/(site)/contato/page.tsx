import Link from "next/link";
import { ArrowUpRight, AtSign, CalendarDays, Mail, MapPin, MessageCircle } from "lucide-react";
import { PublicForm } from "@/components/form-public";
import { Reveal } from "@/components/site";
import { Rich } from "@/components/site-text";
import { getContactForm, toPublic } from "@/lib/forms";
import { getSettings } from "@/lib/settings";
import { getSitePage, siteMetadata } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export const generateMetadata = () => siteMetadata("contato");

async function contacts() {
  try {
    const s = await getSettings(["whatsapp_number", "contact_email"]);
    return { whatsapp: s.whatsapp_number || "351912345678", email: s.contact_email || "ola@marinaloyola.com" };
  } catch {
    return { whatsapp: "351912345678", email: "ola@marinaloyola.com" };
  }
}

export default async function ContatoPage() {
  const [{ whatsapp, email }, page, form] = await Promise.all([
    contacts(),
    getSitePage("contato"),
    // Antes do db:deploy a tabela ainda não existe: a página continua de pé, com os outros canais
    getContactForm().catch(() => null),
  ]);
  const { hero, channels } = page.s;
  const waLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent(channels.waMessage)}`;

  return (
    <section className="grain relative overflow-hidden bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
      <div className="glow-plum pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <div id="bloco-hero" className="scroll-mt-28">
            <p className="kicker flex items-center gap-3">
              <span className="h-px w-10 bg-plum-bright" /> {hero.kicker}
            </p>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
              <Rich text={hero.title} />
            </h1>
            <p className="mt-6 max-w-xl whitespace-pre-line text-zinc-500">{hero.text}</p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal delay={120}>
            <div id="bloco-form" className="scroll-mt-28 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:p-10">
              {form ? (
                <PublicForm form={toPublic(form)} />
              ) : (
                <p className="text-sm text-zinc-500">O formulário está temporariamente indisponível. Fale comigo pelo WhatsApp ou por email.</p>
              )}
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div id="bloco-channels" className="scroll-mt-28 space-y-4">
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-5 rounded-3xl border border-plum/40 bg-plum/[0.04] p-7 transition-transform hover:-translate-y-1"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-plum text-white">
                  <MessageCircle size={22} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-950">{channels.waTitle}</p>
                  <p className="text-sm text-zinc-500">{channels.waText}</p>
                </div>
                <ArrowUpRight size={18} className="text-plum transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
              <a
                href={`mailto:${email}`}
                className="group flex items-center gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-7 transition-colors hover:border-plum/40"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 text-plum">
                  <Mail size={22} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-950">{channels.emailTitle}</p>
                  <p className="text-sm text-zinc-500">{email}</p>
                </div>
                <ArrowUpRight size={18} className="text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
              <div className="flex items-center gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-7">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 text-plum">
                  <MapPin size={22} />
                </span>
                <div>
                  <p className="font-semibold text-zinc-950">{channels.locationTitle}</p>
                  <p className="text-sm text-zinc-500">{channels.locationText}</p>
                </div>
              </div>
              <Link
                href="/agendar"
                className="group flex items-center gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-7 transition-colors hover:border-plum/40"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 text-plum">
                  <CalendarDays size={22} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-950">{channels.bookTitle}</p>
                  <p className="text-sm text-zinc-500">{channels.bookText}</p>
                </div>
                <ArrowUpRight size={18} className="text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </Link>
              <p className="flex items-center gap-2 px-2 pt-2 text-xs text-zinc-500">
                <AtSign size={13} /> {channels.social}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
