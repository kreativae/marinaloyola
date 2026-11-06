import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { PublicForm } from "@/components/form-public";
import { Reveal } from "@/components/site";
import { Rich } from "@/components/site-text";
import { toPublic } from "@/lib/forms";

export const dynamic = "force-dynamic";

const load = async (slug: string) => {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.slug, slug), eq(forms.active, true), isNull(forms.key)))
    .limit(1);
  return form;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const form = await load((await params).slug);
  return form ? { title: form.title.replace(/\*/g, ""), description: form.description || undefined } : {};
}

export default async function FormularioPage({ params }: { params: Promise<{ slug: string }> }) {
  const form = await load((await params).slug);
  if (!form) notFound();
  return (
    <section className="grain relative overflow-hidden bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
      <div className="glow-plum pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px]" />
      <div className="relative mx-auto max-w-3xl px-5 lg:px-8">
        <Reveal>
          {form.kicker && (
            <p className="kicker flex items-center gap-3">
              <span className="h-px w-10 bg-plum-bright" /> {form.kicker}
            </p>
          )}
          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight lg:text-6xl">
            <Rich text={form.title} />
          </h1>
          {form.description && <p className="mt-6 max-w-xl whitespace-pre-line text-zinc-500">{form.description}</p>}
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-12 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:p-10">
            <PublicForm form={toPublic(form)} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
