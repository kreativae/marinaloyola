import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, Sparkles } from "lucide-react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, enrollments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { EmptyState, ProgressBar } from "@/components/admin-ui";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlunoDashboard() {
  const user = await requireUser();

  const rows = await db
    .select({ enrollment: enrollments, course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(eq(enrollments.userId, user.id))
    .orderBy(desc(enrollments.createdAt));

  const totalRows = await db.execute(
    sql`SELECT m.course_id, COUNT(l.id)::int AS n FROM modules m LEFT JOIN lessons l ON l.module_id = m.id GROUP BY 1`
  );
  const doneRows = await db.execute(
    sql`SELECT m.course_id, COUNT(*)::int AS n FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE lp.user_id = ${user.id} GROUP BY m.course_id`
  );
  const totalMap = new Map((totalRows.rows as unknown as { course_id: number; n: number }[]).map((r) => [r.course_id, r.n]));
  const doneMap = new Map((doneRows.rows as unknown as { course_id: number; n: number }[]).map((r) => [r.course_id, r.n]));

  return (
    <>
      <div className="mb-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-plum">
          Área de aluna
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-zinc-950 lg:text-5xl">
          Olá, <span className="italic text-plum">{user.name.split(" ")[0]}.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
          Continue de onde parou. Cada aula concluída aproxima-a do certificado — e de um
          negócio de design com assinatura.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState text="Ainda não tem cursos atribuídos. Explore a oferta formativa em marinaloyola.com/cursos." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {rows.map(({ enrollment, course }) => {
            const total = totalMap.get(course.id) ?? 0;
            const done = doneMap.get(course.id) ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const complete = pct === 100 && total > 0;
            return (
              <Link
                key={enrollment.id}
                href={`/aluno/curso/${course.id}`}
                className="group overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-all hover:-translate-y-1 hover:border-plum/50"
              >
                <div className="relative h-44">
                  {course.cover ? (
                    <Image
                      src={course.cover}
                      alt={course.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-plum/10" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  {complete && (
                    <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      <Award size={12} /> Certificado
                    </span>
                  )}
                  <div className="absolute bottom-4 left-5 right-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
                      {course.level}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-medium leading-tight text-white">
                      {course.title}
                    </h2>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={12} /> {done}/{total} aulas
                    </span>
                    <span className="font-bold tabular-nums text-plum">{pct}%</span>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar pct={pct} />
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                      Inscrita em {fmtDate(enrollment.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-950 transition-colors group-hover:text-plum">
                      Continuar
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-12 flex items-start gap-4 rounded-3xl border border-plum/30 bg-plum/[0.04] p-7">
        <Sparkles size={22} className="mt-0.5 shrink-0 text-plum" />
        <div>
          <p className="font-display text-xl italic text-zinc-950">Dica da Marina</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Estude em blocos de 45 minutos e aplique cada exercício imediatamente ao seu
            próprio projeto. O certificado é emitido automaticamente quando concluir 100%
            das aulas — disponível na página do curso.
          </p>
        </div>
      </div>
    </>
  );
}
