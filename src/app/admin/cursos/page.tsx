import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Eye, EyeOff, GraduationCap, Layers } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { toggleCourse } from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel } from "@/components/admin-ui";
import { eur } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const [list, moduleCounts, lessonCounts, enrollmentCounts] = await Promise.all([
    db.select().from(courses),
    db.execute(sql`SELECT course_id, COUNT(*)::int AS n FROM modules GROUP BY 1`),
    db.execute(
      sql`SELECT m.course_id, COUNT(l.id)::int AS n FROM modules m LEFT JOIN lessons l ON l.module_id = m.id GROUP BY 1`
    ),
    db.execute(sql`SELECT course_id, COUNT(*)::int AS n FROM enrollments GROUP BY 1`),
  ]);

  const mMap = new Map((moduleCounts.rows as unknown as { course_id: number; n: number }[]).map((r) => [r.course_id, r.n]));
  const lMap = new Map((lessonCounts.rows as unknown as { course_id: number; n: number }[]).map((r) => [r.course_id, r.n]));
  const eMap = new Map((enrollmentCounts.rows as unknown as { course_id: number; n: number }[]).map((r) => [r.course_id, r.n]));

  return (
    <>
      <PageHeader
        title="Cursos & LMS"
        subtitle="Gestão de cursos, módulos, aulas e acessos de alunos à plataforma de ensino."
      />
      {list.length === 0 ? (
        <Panel>
          <EmptyState text="Ainda não existem cursos." />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className="card group overflow-hidden">
              <div className="relative h-40">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span
                  className={`chip absolute left-4 top-4 ${
                    c.published
                      ? "border-emerald-500/30 bg-white/90 text-emerald-700"
                      : "border-white/40 bg-white/90 text-zinc-600"
                  }`}
                >
                  {c.published ? "Publicado" : "Rascunho"}
                </span>
                <p className="absolute bottom-4 left-4 font-display text-xl font-medium text-white">
                  {c.title}
                </p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    [<Layers key="i" size={14} className="mx-auto text-plum" />, mMap.get(c.id) ?? 0, "módulos"],
                    [<BookOpen key="i" size={14} className="mx-auto text-plum" />, lMap.get(c.id) ?? 0, "aulas"],
                    [<GraduationCap key="i" size={14} className="mx-auto text-plum" />, eMap.get(c.id) ?? 0, "alunas"],
                  ].map(([icon, n, label], i) => (
                    <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 py-3">
                      {icon}
                      <p className="mt-1 font-display text-xl font-semibold text-zinc-950">{n}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-display text-lg font-semibold text-plum">
                    {eur(c.price)}
                  </span>
                  <span className="text-xs text-zinc-500">{c.level}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/admin/cursos/${c.id}`}
                    className="btn-primary flex-1 !px-4 !py-2.5 !text-xs"
                  >
                    Gerir conteúdo <ArrowUpRight size={13} />
                  </Link>
                  <form action={toggleCourse.bind(null, c.id)}>
                    <button
                      type="submit"
                      title={c.published ? "Despublicar" : "Publicar"}
                      className="flex h-full items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-plum/50 hover:text-zinc-950"
                    >
                      {c.published ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
