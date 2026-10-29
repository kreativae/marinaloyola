import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ListChecks, Shuffle, Target, Users, XCircle } from "lucide-react";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { lessons, modules, quizAttempts, quizQuestions, users } from "@/db/schema";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import {
  ImportQuestionsForm,
  NewQuestionForm,
  QuestionCard,
  QuizSettingsForm,
  type QuestionData,
} from "@/components/quiz-admin";
import { cn, fmtDateTime, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId: lid } = await params;
  const courseId = Number(id);
  const lessonId = Number(lid);
  if (!Number.isInteger(courseId) || !Number.isInteger(lessonId)) notFound();

  const [found] = await db
    .select({ lesson: lessons, courseId: modules.courseId, moduleTitle: modules.title })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!found || found.courseId !== courseId || found.lesson.type !== "quiz") notFound();
  const lesson = found.lesson;

  const [questions, attempts] = await Promise.all([
    db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.lessonId, lessonId))
      .orderBy(asc(quizQuestions.order), asc(quizQuestions.id)),
    db
      .select({ a: quizAttempts, name: users.name, email: users.email })
      .from(quizAttempts)
      .innerJoin(users, eq(users.id, quizAttempts.userId))
      .where(and(eq(quizAttempts.lessonId, lessonId), isNotNull(quizAttempts.submittedAt)))
      .orderBy(desc(quizAttempts.submittedAt)),
  ]);

  // Estatísticas por questão a partir das tentativas entregues
  const shown = new Map<number, number>();
  const right = new Map<number, number>();
  for (const { a } of attempts) {
    for (const it of a.items) {
      shown.set(it.qid, (shown.get(it.qid) ?? 0) + 1);
      const q = questions.find((x) => x.id === it.qid);
      if (q && a.answers?.[String(it.qid)] === q.answer) right.set(it.qid, (right.get(it.qid) ?? 0) + 1);
    }
  }
  const data: QuestionData[] = questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    active: q.active,
    shown: shown.get(q.id) ?? 0,
    accuracy: shown.get(q.id) ? Math.round(((right.get(q.id) ?? 0) / shown.get(q.id)!) * 100) : null,
  }));

  const active = questions.filter((q) => q.active).length;
  const draw = Math.min(lesson.quizDraw ?? active, active);
  const students = new Set(attempts.map((r) => r.a.userId)).size;
  const passed = attempts.filter((r) => r.a.passed).length;
  const avg = attempts.length ? Math.round(attempts.reduce((s, r) => s + (r.a.score ?? 0), 0) / attempts.length) : null;

  return (
    <>
      <Link
        href={`/admin/cursos/${courseId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-plum"
      >
        <ArrowLeft size={15} /> Voltar ao curso
      </Link>

      <PageHeader title={lesson.title} subtitle={`Quiz · ${found.moduleTitle} · banco de questões e resultados das alunas`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Questões no banco" value={num(active)} hint={questions.length > active ? `${questions.length - active} desactivada(s)` : undefined} icon={<ListChecks size={17} />} />
        <StatCard label="Sorteadas por aluna" value={active ? `${draw} de ${active}` : "—"} icon={<Shuffle size={17} />} accent />
        <StatCard label="Tentativas" value={num(attempts.length)} hint={`${students} aluna(s)`} icon={<Users size={17} />} />
        <StatCard
          label="Aprovação"
          value={attempts.length ? `${Math.round((passed / attempts.length) * 100)}%` : "—"}
          hint={avg !== null ? `Nota média ${avg}%` : undefined}
          icon={<Target size={17} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Panel title={`Banco de questões (${questions.length})`}>
            {data.length === 0 ? (
              <EmptyState text="Ainda não há questões. Adicione uma a uma ou importe várias de uma vez." />
            ) : (
              <ul className="space-y-3">
                {data.map((q, i) => (
                  <QuestionCard key={q.id} q={q} index={i + 1} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Nova questão">
            <NewQuestionForm lessonId={lessonId} />
          </Panel>

          <Panel title="Importar várias questões">
            <p className="mb-3 text-xs leading-relaxed text-zinc-500">
              Uma questão por bloco, separadas por uma linha vazia. A opção certa começa por <b>*</b>, as erradas por{" "}
              <b>-</b> e a explicação (opcional) por <b>&gt;</b>.
            </p>
            <ImportQuestionsForm lessonId={lessonId} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Definições do quiz">
            <QuizSettingsForm
              lessonId={lessonId}
              title={lesson.title}
              durationMin={lesson.durationMin}
              draw={lesson.quizDraw}
              minScore={lesson.quizMinScore}
              content={lesson.content}
              poolSize={active}
            />
          </Panel>

          <Panel title={`Resultados das alunas (${attempts.length})`}>
            {attempts.length === 0 ? (
              <EmptyState text="Nenhuma tentativa entregue ainda." />
            ) : (
              <ul className="space-y-2.5">
                {attempts.slice(0, 50).map(({ a, name, email }) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    {a.passed ? (
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle size={16} className="shrink-0 text-rose-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-950">{name}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {email} · {a.submittedAt ? fmtDateTime(a.submittedAt) : ""} · questões{" "}
                        {a.items
                          .map((it) => data.findIndex((q) => q.id === it.qid) + 1)
                          .filter((n) => n > 0)
                          .sort((x, y) => x - y)
                          .join(", ")}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-sm font-bold tabular-nums", a.passed ? "text-emerald-700" : "text-rose-600")}>
                      {a.score}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
