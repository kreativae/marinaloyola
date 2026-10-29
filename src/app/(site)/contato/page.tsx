import Link from "next/link";
import { ArrowUpRight, AtSign, CalendarDays, Mail, MapPin, MessageCircle, Send } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { Reveal } from "@/components/site";
import { submitLead } from "@/lib/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Fale com Marina Loyola: formulário, WhatsApp direto ou email. Resposta em menos de 24 horas úteis.",
};

const SUBJECTS = [
  "Mentoria 1:1",
  "Workshops & Cursos",
  "Parcerias & Imprensa",
  "Outro assunto",
];

async function getSettings() {
  try {
    const rows = await db.select().from(settings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      whatsapp: map.whatsapp_number || "351912345678",
      email: map.contact_email || "ola@marinaloyola.com",
    };
  } catch {
    return { whatsapp: "351912345678", email: "ola@marinaloyola.com" };
  }
}

export default async function ContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const { whatsapp, email } = await getSettings();
  const waLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    "Olá Marina! Gostaria de falar consigo."
  )}`;

  return (
    <section className="grain relative overflow-hidden bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
      <div className="glow-plum pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <p className="kicker flex items-center gap-3">
            <span className="h-px w-10 bg-plum-bright" /> Contacto
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-7xl">
            Vamos <span className="italic text-plum">conversar.</span>
          </h1>
          <p className="mt-6 max-w-xl text-zinc-500">
            Resposta em menos de 24 horas úteis. Escolha o canal que lhe for mais
            confortável — ou escreva diretamente pelo formulário.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal delay={120}>
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:p-10">
              {ok === "1" ? (
                <div className="rounded-2xl border border-plum/40 bg-plum/[0.06] p-8 text-center">
                  <p className="font-display text-3xl italic">Mensagem recebida.</p>
                  <p className="mx-auto mt-3 max-w-sm text-sm text-zinc-600">
                    Obrigada pelo contacto — responderei em menos de 24 horas úteis.
                    Entretanto, pode acompanhar o trabalho no Instagram.
                  </p>
                  <Link href="/agendar" className="btn-primary mt-6">
                    <CalendarDays size={15} /> Agendar sessão exploratória
                  </Link>
                </div>
              ) : (
                <form action={submitLead} className="space-y-5">
                  <input type="hidden" name="tag" value="Contacto Site" />
                  <input type="hidden" name="redirectTo" value="/contato?ok=1" />
                  {erro === "1" && (
                    <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                      Preencha pelo menos o nome e o email.
                    </p>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Nome *
                      </label>
                      <input name="name" required className="field" placeholder="O seu nome" />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Email *
                      </label>
                      <input
                        name="email"
                        type="email"
                        required
                        className="field"
                        placeholder="voce@email.com"
                      />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Telefone / WhatsApp
                      </label>
                      <input name="phone" className="field" placeholder="+351 ..." />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Assunto
                      </label>
                      <select name="subject" className="field">
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s} className="bg-white">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Mensagem
                    </label>
                    <textarea
                      name="message"
                      rows={5}
                      className="field resize-none"
                      placeholder="Conte-me onde está e onde quer chegar..."
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full sm:w-auto">
                    <Send size={15} />
                    Enviar mensagem
                  </button>
                </form>
              )}
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div className="space-y-4">
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
                  <p className="font-semibold text-zinc-950">WhatsApp direto</p>
                  <p className="text-sm text-zinc-500">O canal mais rápido — resposta no próprio dia.</p>
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
                  <p className="font-semibold text-zinc-950">Email</p>
                  <p className="text-sm text-zinc-500">{email}</p>
                </div>
                <ArrowUpRight size={18} className="text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
              <div className="flex items-center gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-7">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 text-plum">
                  <MapPin size={22} />
                </span>
                <div>
                  <p className="font-semibold text-zinc-950">Lisboa, Portugal</p>
                  <p className="text-sm text-zinc-500">Sessões online para todo o mundo.</p>
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
                  <p className="font-semibold text-zinc-950">Agendar diretamente</p>
                  <p className="text-sm text-zinc-500">Escolha data e hora em tempo real.</p>
                </div>
                <ArrowUpRight size={18} className="text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </Link>
              <p className="flex items-center gap-2 px-2 pt-2 text-xs text-zinc-500">
                <AtSign size={13} /> @marinaloyola nas redes sociais
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
