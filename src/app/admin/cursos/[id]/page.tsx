import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  Paperclip,
  Play,
  Plus,
  UserPlus,
} from "lucide-react";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessons,
  courseFiles,
  modules,
  quizQuestions,
  users,
} from "@/db/schema";
import {
  createLesson,
  createModule,
  enrollStudent,
  toggleCourse,
} from "@/lib/actions-admin";
import { EmptyState, PageHeader, Panel, ProgressBar } from "@/components/admin-ui";
import {
  CourseEditButton,
  FileRow,
  LessonActions,
  ModuleActions,
  QuizLink,
  UploadFiles,
} from "@/components/course-admin";
import { fmtBytes } from "@/lib/files";
import { eur, fmtDate, LESSON_TYPES } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LESSON_ICONS = { video: Play, material: FileText, quiz: ListChecks } as const;

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();

  const [[course], moduleRows, enrolledRows, totalLessonsRow, progressRows] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, courseId)).limit(1),
    db.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(asc(modules.order)),
    db
      .select({ enrollment: enrollments, userName: users.name, userEmail: users.email })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(eq(enrollments.courseId, courseId)),
    db.execute(
      sql`SELECT COUNT(l.id)::int AS n FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ${courseId}`
    ),
    db.execute(
      sql`SELECT lp.user_id, COUNT(*)::int AS n FROM lesson_progress lp
          JOIN lessons l ON l.id = lp.lesson_id
          JOIN modules m ON m.id = l.module_id
          WHERE m.course_id = ${courseId} GROUP BY lp.user_id`
    ),
  ]);

  if (!course) notFound();

  const lessonRows = moduleRows.length
    ? await db
        .select()
        .from(lessons)
        .where(sql`${lessons.moduleId} IN ${moduleRows.map((m) => m.id)}`)
        .orderBy(asc(lessons.order))
    : [];

  const quizLessonIds = lessonRows.filter((l) => l.type === "quiz").map((l) => l.id);
  const questionCounts = new Map(
    (quizLessonIds.length
      ? await db
          .select({ lessonId: quizQuestions.lessonId, n: count() })
          .from(quizQuestions)
          .where(and(inArray(quizQuestions.lessonId, quizLessonIds), eq(quizQuestions.active, true)))
          .groupBy(quizQuestions.lessonId)
      : []
    ).map((r) => [r.lessonId, r.n])
  );

  const fileRows = await db
    .select()
    .from(courseFiles)
    .where(eq(courseFiles.courseId, courseId))
    .orderBy(asc(courseFiles.createdAt));
  const filesByLesson = new Map<number, number>();
  for (const f of fileRows) if (f.lessonId) filesByLesson.set(f.lessonId, (filesByLesson.get(f.lessonId) ?? 0) + 1);

  const lessonsByModule = new Map<number, typeof lessonRows>();
  for (const l of lessonRows) {
    const arr = lessonsByModule.get(l.moduleId) ?? [];
    arr.push(l);
    lessonsByModule.set(l.moduleId, arr);
  }

  // Aulas na ordem do curso (módulo, depois aula), para os selects de ficheiros
  const allLessons = moduleRows.flatMap((m) =>
    (lessonsByModule.get(m.id) ?? []).map((l) => ({ id: l.id, title: l.title }))
  );

  const totalLessons = (totalLessonsRow.rows as unknown as { n: number }[])[0]?.n ?? 0;
  const progressMap = new Map(
    (progressRows.rows as unknown as { user_id: number; n: number }[]).map((r) => [r.user_id, r.n])
  );

  return (
    <>
      <Link
        href="/admin/cursos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-plum"
      >
        <ArrowLeft size={15} /> Voltar aos cursos
      </Link>

      <PageHeader
        title={course.title}
        subtitle={`${course.level} · ${eur(course.price)} · ${course.published ? "publicado" : "rascunho"}`}
        actions={
          <>
            <CourseEditButton
              course={{
                id: course.id,
                title: course.title,
                slug: course.slug,
                subtitle: course.subtitle,
                description: course.description,
                level: course.level,
                price: course.price,
                cover: course.cover,
                hotmartUrl: course.hotmartUrl,
              }}
            />
            <form action={toggleCourse.bind(null, course.id)}>
              <button type="submit" className="btn-ghost !px-5 !py-2.5 !text-xs">
                {course.published ? "Despublicar" : "Publicar"}
              </button>
            </form>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Currículo */}
        <div className="space-y-6">
          {moduleRows.map((m, mi) => (
            <Panel
              key={m.id}
              title={`Módulo ${mi + 1} · ${m.title}`}
              action={
                <ModuleActions
                  id={m.id}
                  title={m.title}
                  first={mi === 0}
                  last={mi === moduleRows.length - 1}
                  lessonCount={(lessonsByModule.get(m.id) ?? []).length}
                />
              }
            >
              {(lessonsByModule.get(m.id) ?? []).length === 0 ? (
                <EmptyState text="Sem aulas neste módulo." />
              ) : (
                <ul className="mb-5 space-y-2">
                  {(lessonsByModule.get(m.id) ?? []).map((l, li, arr) => {
                    const Icon = LESSON_ICONS[l.type];
                    const n = questionCounts.get(l.id) ?? 0;
                    const files = filesByLesson.get(l.id) ?? 0;
                    return (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-4 pr-2"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-plum/20 text-plum">
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-zinc-950">{l.title}</span>
                          <span className="flex flex-wrap items-center gap-x-3 text-[11px] text-zinc-500">
                            <span className="uppercase tracking-wider">
                              {LESSON_TYPES[l.type]} · {l.durationMin} min
                            </span>
                            {files > 0 && (
                              <span className="flex items-center gap-1">
                                <Paperclip size={11} /> {files}
                              </span>
                            )}
                            {l.type === "quiz" && (
                              <QuizLink
                                href={`/admin/cursos/${course.id}/quiz/${l.id}`}
                                label={n ? `${Math.min(l.quizDraw ?? n, n)} de ${n} questões` : "Adicionar questões"}
                              />
                            )}
                          </span>
                        </span>
                        <LessonActions
                          lesson={{
                            id: l.id,
                            moduleId: l.moduleId,
                            title: l.title,
                            type: l.type,
                            durationMin: l.durationMin,
                            videoUrl: l.videoUrl,
                            materialUrl: l.materialUrl,
                            content: l.content,
                          }}
                          courseId={course.id}
                          modules={moduleRows.map(({ id, title }) => ({ id, title }))}
                          first={li === 0}
                          last={li === arr.length - 1}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <details className="rounded-xl border border-dashed border-zinc-200 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 hover:text-plum">
                  <Plus size={13} /> Adicionar aula
                </summary>
                <form action={createLesson} className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <input type="hidden" name="moduleId" value={m.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input name="title" required placeholder="Título da aula *" className="field sm:col-span-2" />
                  <select name="type" className="field">
                    <option value="video" className="bg-white">Vídeo</option>
                    <option value="material" className="bg-white">Material</option>
                    <option value="quiz" className="bg-white">Quiz (banco de questões)</option>
                  </select>
                  <input name="durationMin" type="number" min="1" defaultValue={10} className="field" />
                  <input name="videoUrl" placeholder="URL do vídeo (mp4/embed)" className="field sm:col-span-2" />
                  <textarea name="content" rows={2} placeholder="Descrição / conteúdo de apoio" className="field resize-none sm:col-span-2" />
                  <button type="submit" className="btn-primary !py-2.5 !text-xs sm:col-span-2">
                    Guardar aula
                  </button>
                </form>
              </details>
            </Panel>
          ))}

          <Panel title="Novo módulo">
            <form action={createModule} className="flex gap-3">
              <input type="hidden" name="courseId" value={course.id} />
              <input
                name="title"
                required
                placeholder="Ex: Módulo 4 — Apresentação e entrega"
                className="field flex-1"
              />
              <button type="submit" className="btn-primary shrink-0 !px-5 !py-2.5 !text-xs">
                <Layers size={14} /> Criar
              </button>
            </form>
          </Panel>

          <Panel title={`Ficheiros complementares (${fileRows.length})`}>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              Templates, PDFs, ficheiros Figma… As alunas inscritas descarregam-nos na página da aula ou na secção
              “Materiais do curso”. Os ficheiros não ficam públicos.
            </p>
            <UploadFiles courseId={course.id} lessons={allLessons} />
            {fileRows.length > 0 && (
              <ul className="mt-5 space-y-2">
                {fileRows.map((f) => (
                  <FileRow
                    key={f.id}
                    lessons={allLessons}
                    file={{
                      id: f.id,
                      name: f.name,
                      size: fmtBytes(f.size),
                      mime: f.mime,
                      lessonId: f.lessonId,
                      downloads: f.downloads,
                      createdAt: f.createdAt.toISOString(),
                    }}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Alunas */}
        <div className="space-y-6">
          <Panel title={`Alunas inscritas (${enrolledRows.length})`}>
            <form action={enrollStudent} className="mb-5 grid gap-2.5">
              <input type="hidden" name="courseId" value={course.id} />
              <input name="email" type="email" required placeholder="Email da aluna *" className="field" />
              <input name="name" placeholder="Nome (para novas contas)" className="field" />
              <button type="submit" className="btn-primary !py-2.5 !text-xs">
                <UserPlus size={14} /> Dar acesso ao curso
              </button>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Se o email ainda não existir, é criada uma conta com a password provisória{" "}
                <span className="font-semibold text-zinc-500">aluno123</span> e enviadas as
                instruções de primeiro acesso.
              </p>
            </form>
            {enrolledRows.length === 0 ? (
              <EmptyState text="Sem alunas inscritas." />
            ) : (
              <ul className="space-y-3">
                {enrolledRows.map(({ enrollment, userName, userEmail }) => {
                  const done = progressMap.get(enrollment.userId) ?? 0;
                  const pct = totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0;
                  return (
                    <li
                      key={enrollment.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <GraduationCap size={15} className="shrink-0 text-plum" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-950">{userName}</p>
                            <p className="truncate text-xs text-zinc-500">{userEmail}</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-plum">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-3">
                        <ProgressBar pct={pct} />
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {done}/{totalLessons} aulas · inscrita em {fmtDate(enrollment.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Metadados">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Slug</dt>
                <dd className="font-mono text-xs text-zinc-600">{course.slug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Link Hotmart</dt>
                <dd className="max-w-[60%] truncate text-xs text-plum">
                  {course.hotmartUrl ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Aulas totais</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-zinc-950">
                  <BookOpen size={13} className="text-plum" /> {totalLessons}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
