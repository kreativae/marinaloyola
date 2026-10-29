import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  ListChecks,
  Lock,
  Paperclip,
  Play,
} from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessonProgress,
  lessons,
  modules,
  courseFiles,
  quizAttempts,
  type CourseFile,
  type Lesson,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { CompleteButton, PrintButton, QuizPlayer, VideoPlayer, type QuizAttemptView } from "@/components/lms";
import { fmtBytes } from "@/lib/files";
import { activeQuestions, attemptView, latestAttempt } from "@/lib/quiz";
import { ProgressBar } from "@/components/admin-ui";
import { cn, fmtDate, LESSON_TYPES } from "@/lib/utils";

export const dynamic = "force-dynamic";

type QuizProps = {
  minScore: number;
  poolSize: number;
  drawCount: number;
  attemptsCount: number;
  bestScore: number | null;
  attempt: QuizAttemptView | null;
};

const TYPE_ICONS = { video: Play, material: FileText, quiz: ListChecks } as const;

export default async function CoursePlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aula?: string; cert?: string }>;
}) {
  const { id } = await params;
  const { aula, cert } = await searchParams;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();

  const user = await requireUser();

  const [[course], enrollment] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, courseId)).limit(1),
    db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, user.id)))
      .limit(1),
  ]);
  if (!course) notFound();
  if (!enrollment && user.role === "student") redirect("/aluno");

  const moduleRows = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.order));

  // Buscar aulas por módulo (ordem garantida)
  const lessonsByModule = new Map<number, Lesson[]>();
  for (const m of moduleRows) {
    const ls = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, m.id))
      .orderBy(asc(lessons.order));
    lessonsByModule.set(m.id, ls);
  }

  const flat: { lesson: Lesson; module: (typeof moduleRows)[number] }[] = [];
  for (const m of moduleRows) {
    for (const l of lessonsByModule.get(m.id) ?? []) flat.push({ lesson: l, module: m });
  }

  const files = await db
    .select()
    .from(courseFiles)
    .where(eq(courseFiles.courseId, courseId))
    .orderBy(asc(courseFiles.createdAt));
  const generalFiles = files.filter((f) => !f.lessonId);

  const progressRows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, user.id));
  const doneSet = new Set(progressRows.map((r) => r.lessonId));
  const total = flat.length;
  const done = flat.filter((f) => doneSet.has(f.lesson.id)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  /* ------------------------- CERTIFICADO ------------------------- */
  if (cert === "1" && pct === 100) {
    const certId = `ML-${course.id}${String(user.id).padStart(4, "0")}-${new Date().getFullYear()}`;
    return (
      <div className="animate-fade-in">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/aluno/curso/${course.id}`}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-plum"
          >
            <ArrowLeft size={15} /> Voltar ao curso
          </Link>
          <PrintButton />
        </div>
        <div className="rounded-sm bg-white p-2 shadow-2xl">
          <div className="relative border-[3px] border-double border-plum/60 bg-white px-8 py-16 text-center text-zinc-950 lg:px-20 lg:py-20">
            <div className="absolute inset-3 border border-plum/20" />
            <div className="relative">
              <p className="font-display text-2xl font-semibold italic text-plum">
                Marina Loyola
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">
                Escola de Design & Negócio
              </p>
              <div className="mx-auto my-10 h-px w-24 bg-plum/40" />
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-zinc-500">
                Certificado de conclusão
              </p>
              <p className="mt-6 text-sm text-zinc-500">Certifica-se que</p>
              <p className="mt-3 font-display text-5xl font-medium tracking-tight">
                {user.name}
              </p>
              <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-zinc-500">
                concluiu com aproveitamento a totalidade do programa
              </p>
              <p className="mt-4 font-display text-3xl italic text-plum">{course.title}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
                {total} aulas · carga horária estimada de{" "}
                {Math.round(flat.reduce((a, f) => a + f.lesson.durationMin, 0) / 60)} horas
              </p>
              <div className="mx-auto mt-14 flex max-w-md items-end justify-between">
                <div className="text-left">
                  <p className="font-display text-2xl italic text-zinc-800">Marina Loyola</p>
                  <div className="mt-1 h-px w-44 bg-zinc-300" />
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Mentora & Diretora Criativa
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-800">{fmtDate(new Date())}</p>
                  <div className="mt-1 h-px w-32 bg-zinc-300" />
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Lisboa, Portugal
                  </p>
                </div>
              </div>
              <p className="mt-12 font-mono text-[10px] tracking-[0.2em] text-zinc-500">
                ID {certId} · verificável em marinaloyola.com
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------- PLAYER ---------------------------- */
  const requested = flat.find((f) => f.lesson.id === Number(aula));
  const firstIncomplete = flat.find((f) => !doneSet.has(f.lesson.id));
  const current = requested ?? firstIncomplete ?? flat[0];
  const currentIndex = current ? flat.findIndex((f) => f.lesson.id === current.lesson.id) : -1;
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  let quiz: QuizProps | null = null;
  if (current?.lesson.type === "quiz") {
    const l = current.lesson;
    const [pool, attempt, history] = await Promise.all([
      activeQuestions(l.id),
      latestAttempt(user.id, l.id),
      db
        .select({ score: quizAttempts.score })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.userId, user.id), eq(quizAttempts.lessonId, l.id))),
    ]);
    const view = attempt ? await attemptView(attempt) : null;
    const scores = history.map((h) => h.score).filter((n): n is number => n !== null);
    quiz = {
      minScore: l.quizMinScore,
      poolSize: pool.length,
      drawCount: Math.min(l.quizDraw ?? pool.length, pool.length),
      attemptsCount: history.length,
      bestScore: scores.length ? Math.max(...scores) : null,
      attempt:
        attempt && view
          ? { id: attempt.id, questions: view.questions, results: view.results, score: attempt.score, passed: attempt.passed }
          : null,
    };
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      {/* Sidebar currículo */}
      <aside className="h-fit space-y-5 lg:sticky lg:top-24">
        <Link
          href="/aluno"
          className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-plum"
        >
          <ArrowLeft size={15} /> Os meus cursos
        </Link>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-plum">
            {course.level}
          </p>
          <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-zinc-950">
            {course.title}
          </h1>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {done}/{total} aulas
              </span>
              <span className="font-bold tabular-nums text-plum">{pct}%</span>
            </div>
            <div className="mt-2">
              <ProgressBar pct={pct} />
            </div>
          </div>
          {pct === 100 && total > 0 && (
            <Link
              href={`/aluno/curso/${course.id}?cert=1`}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-plum px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-transform hover:scale-[1.02]"
            >
              <Award size={15} /> Emitir certificado
            </Link>
          )}
        </div>

        {generalFiles.length > 0 && (
          <a
            href="#materiais"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:border-plum/40 hover:text-plum"
          >
            <Paperclip size={14} className="text-plum" /> Materiais do curso ({generalFiles.length})
          </a>
        )}

        <nav className="space-y-3">
          {moduleRows.map((m, mi) => (
            <div key={m.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              <p className="border-b border-zinc-200 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Módulo {mi + 1} · {m.title}
              </p>
              <ul>
                {(lessonsByModule.get(m.id) ?? []).map((l) => {
                  const Icon = TYPE_ICONS[l.type];
                  const isDone = doneSet.has(l.id);
                  const isCurrent = current?.lesson.id === l.id;
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/aluno/curso/${course.id}?aula=${l.id}`}
                        className={cn(
                          "flex items-center gap-2.5 border-b border-zinc-200 px-4 py-2.5 text-sm transition-colors last:border-0",
                          isCurrent
                            ? "bg-plum/20 text-zinc-950"
                            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        ) : (
                          <Icon size={14} className="shrink-0 text-zinc-500" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                        <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                          {l.durationMin}&#8242;
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Área da aula */}
      <div>
        {!current ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 p-16 text-center text-zinc-500">
            <Lock size={28} className="mx-auto mb-4 text-plum" />
            Este curso ainda não tem aulas publicadas.
          </div>
        ) : (
          <div className="animate-fade-in space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <span className="text-plum">
                  Módulo {moduleRows.findIndex((m) => m.id === current.module.id) + 1}
                </span>
                <span>·</span>
                <span>{LESSON_TYPES[current.lesson.type]}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {current.lesson.durationMin} min
                </span>
              </div>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-zinc-950 lg:text-4xl">
                {current.lesson.title}
              </h2>
            </div>

            {current.lesson.type === "video" && current.lesson.videoUrl && (
              <VideoPlayer
                src={current.lesson.videoUrl}
                lessonId={current.lesson.id}
                done={doneSet.has(current.lesson.id)}
                title={current.lesson.title}
              />
            )}

            {current.lesson.type === "quiz" && quiz ? (
              <>
                {current.lesson.content && (
                  <p className="text-sm leading-relaxed text-zinc-600">{current.lesson.content}</p>
                )}
                <QuizPlayer
                  key={quiz.attempt?.id ?? "novo"}
                  lessonId={current.lesson.id}
                  done={doneSet.has(current.lesson.id)}
                  {...quiz}
                />
              </>
            ) : null}

            {current.lesson.type === "material" && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
                <div className="prose-invert max-w-none space-y-4 text-sm leading-relaxed text-zinc-600">
                  {current.lesson.content?.split("\n\n").map((p, i) => <p key={i}>{p}</p>) ??
                    <p>Conteúdo em preparação.</p>}
                </div>
                {current.lesson.materialUrl && (
                  <a
                    href={current.lesson.materialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost mt-6"
                  >
                    <Download size={15} /> Descarregar material (PDF)
                  </a>
                )}
              </div>
            )}

            {files.some((f) => f.lessonId === current.lesson.id) && (
              <FileList title="Ficheiros desta aula" files={files.filter((f) => f.lessonId === current.lesson.id)} />
            )}

            {current.lesson.type !== "material" && current.lesson.content && current.lesson.type !== "quiz" && (
              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm leading-relaxed text-zinc-500">
                {current.lesson.content.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-6">
              {prev ? (
                <Link
                  href={`/aluno/curso/${course.id}?aula=${prev.lesson.id}`}
                  className="btn-ghost !px-5 !py-2.5 !text-xs"
                >
                  <ArrowLeft size={14} /> Aula anterior
                </Link>
              ) : (
                <span />
              )}
              {current.lesson.type !== "quiz" && (
                <CompleteButton lessonId={current.lesson.id} done={doneSet.has(current.lesson.id)} />
              )}
              {next ? (
                <Link
                  href={`/aluno/curso/${course.id}?aula=${next.lesson.id}`}
                  className="btn-dark !px-5 !py-2.5 !text-xs"
                >
                  Próxima aula <ArrowRight size={14} />
                </Link>
              ) : (
                pct === 100 && (
                  <Link
                    href={`/aluno/curso/${course.id}?cert=1`}
                    className="btn-primary !px-5 !py-2.5 !text-xs"
                  >
                    <Award size={14} /> Emitir certificado
                  </Link>
                )
              )}
            </div>
          </div>
        )}

        {generalFiles.length > 0 && (
          <div id="materiais" className="mt-10 scroll-mt-24">
            <FileList title="Materiais do curso" files={generalFiles} />
          </div>
        )}
      </div>
    </div>
  );
}

function FileList({ title, files }: { title: string; files: CourseFile[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        <Paperclip size={13} className="text-plum" /> {title}
      </p>
      <ul className="divide-y divide-zinc-100">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-plum/10 text-plum">
              <FileText size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-900">{f.name}</span>
              <span className="text-[11px] text-zinc-500">{fmtBytes(f.size)}</span>
            </span>
            {/(pdf|image)/.test(f.mime) && (
              <a href={`/api/ficheiros/${f.id}?ver=1`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-zinc-500 hover:text-plum">
                Ver
              </a>
            )}
            <a href={`/api/ficheiros/${f.id}`} className="btn-ghost !px-3.5 !py-1.5 !text-xs">
              <Download size={13} /> Descarregar
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
