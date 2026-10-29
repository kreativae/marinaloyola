import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Eye, EyeOff, GraduationCap, Layers, Trophy, TrendingUp, Users } from "lucide-react";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { toggleCourse } from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { NewCourseButton } from "@/components/course-admin";
import { cn, eur, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Stats = { course_id: number; modules: number; lessons: number; students: number; completion: number; finished: number; revenue: number };

export default async function AdminCoursesPage() {
  const [list, statRows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.createdAt)),
    // Por curso: módulos, aulas, alunas, conclusão média, alunas que terminaram e receita confirmada
    // (pagamentos cujo produto contém o título do curso, ou vice-versa: "Curso X" ↔ "X")
    db.execute(sql`
      WITH lc AS (
        SELECT m.course_id, COUNT(l.id)::int AS lessons, COUNT(DISTINCT m.id)::int AS modules
        FROM modules m LEFT JOIN lessons l ON l.module_id = m.id GROUP BY m.course_id
      ),
      prog AS (
        SELECT e.course_id, e.user_id,
          (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id JOIN modules m ON m.id = l.module_id
            WHERE m.course_id = e.course_id AND lp.user_id = e.user_id)::float AS done
        FROM enrollments e
      )
      SELECT c.id AS course_id,
        COALESCE(lc.modules, 0) AS modules,
        COALESCE(lc.lessons, 0) AS lessons,
        (SELECT COUNT(*) FROM prog WHERE prog.course_id = c.id)::int AS students,
        COALESCE((SELECT AVG(LEAST(done / NULLIF(lc.lessons, 0), 1)) FROM prog WHERE prog.course_id = c.id), 0)::float AS completion,
        (SELECT COUNT(*) FROM prog WHERE prog.course_id = c.id AND lc.lessons > 0 AND done >= lc.lessons)::int AS finished,
        COALESCE((SELECT SUM(p.amount::numeric) FROM payments p
          WHERE p.status IN ('confirmed','completed')
            AND (p.product ILIKE '%' || c.title || '%' OR c.title ILIKE '%' || p.product || '%')), 0)::float AS revenue
      FROM courses c LEFT JOIN lc ON lc.course_id = c.id`),
  ]);

  const stats = new Map((statRows.rows as unknown as Stats[]).map((r) => [r.course_id, r]));
  const totalStudents = [...stats.values()].reduce((s, r) => s + r.students, 0);
  const totalFinished = [...stats.values()].reduce((s, r) => s + r.finished, 0);
  const totalRevenue = [...stats.values()].reduce((s, r) => s + r.revenue, 0);
  const withStudents = [...stats.values()].filter((r) => r.students > 0);
  const avgCompletion = withStudents.length ? Math.round((withStudents.reduce((s, r) => s + r.completion, 0) / withStudents.length) * 100) : 0;
  const published = list.filter((c) => c.published).length;

  return (
    <>
      <PageHeader
        title="Cursos & LMS"
        subtitle="Cursos, módulos e aulas, acessos das alunas e o progresso de cada turma."
        actions={<NewCourseButton />}
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cursos" value={num(list.length)} hint={`${published} publicado(s) · ${list.length - published} rascunho(s)`} icon={<BookOpen size={17} />} />
        <StatCard label="Alunas inscritas" value={num(totalStudents)} hint="inscrições em todos os cursos" icon={<Users size={17} />} accent />
        <StatCard label="Conclusão média" value={`${avgCompletion}%`} hint={`${num(totalFinished)} aluna(s) concluíram`} icon={<Trophy size={17} />} />
        <StatCard label="Receita dos cursos" value={eur(totalRevenue)} hint="pagamentos confirmados" icon={<TrendingUp size={17} />} />
      </div>

      {list.length === 0 ? (
        <Panel>
          <EmptyState text="Ainda não existem cursos. Crie o primeiro em “Novo curso”." icon={<GraduationCap size={18} />} />
        </Panel>
      ) : (
        <div className="stagger grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const st = stats.get(c.id);
            const pct = Math.round((st?.completion ?? 0) * 100);
            return (
              <div key={c.id} className="card card-hover group flex flex-col overflow-hidden">
                <Link href={`/admin/cursos/${c.id}`} className="relative block h-44 overflow-hidden">
                  {c.cover ? (
                    <Image src={c.cover} alt={c.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-plum/[0.07] text-plum/40">
                      <GraduationCap size={42} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.65),transparent_60%)]" />
                  <span
                    className={cn(
                      "absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider backdrop-blur",
                      c.published ? "text-emerald-700" : "text-zinc-500"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", c.published ? "bg-emerald-500" : "bg-zinc-400")} />
                    {c.published ? "Publicado" : "Rascunho"}
                  </span>
                  <div className="absolute inset-x-4 bottom-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{c.level}</p>
                    <p className="mt-0.5 font-display text-xl font-medium leading-tight text-white">{c.title}</p>
                  </div>
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line">
                    {[
                      [Layers, st?.modules ?? 0, "módulos"],
                      [BookOpen, st?.lessons ?? 0, "aulas"],
                      [Users, st?.students ?? 0, "alunas"],
                    ].map(([Icon, n, label]) => {
                      const I = Icon as typeof Layers;
                      return (
                        <div key={label as string} className="py-3 text-center">
                          <I size={14} className="mx-auto text-plum" />
                          <p className="mt-1 font-display text-lg font-semibold leading-none text-zinc-950">{num(n as number)}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">{label as string}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Conclusão média</span>
                      <span className="font-semibold tabular-nums text-zinc-900">{st?.students ? `${pct}%` : "—"}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="grow-x h-full rounded-full bg-plum" style={{ width: `${Math.max(pct, st?.students ? 2 : 0)}%` }} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="font-display text-xl font-semibold text-zinc-950">{eur(c.price)}</p>
                      <p className="text-[11px] text-zinc-500">{st?.revenue ? `${eur(st.revenue)} faturado` : "sem vendas ainda"}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <form action={toggleCourse.bind(null, c.id)}>
                        <button
                          type="submit"
                          title={c.published ? "Despublicar" : "Publicar"}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-zinc-500 transition-colors hover:border-plum/30 hover:text-plum"
                        >
                          {c.published ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </form>
                      <Link href={`/admin/cursos/${c.id}`} className="btn-primary !px-4 !py-2.5 !text-xs">
                        Gerir <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
