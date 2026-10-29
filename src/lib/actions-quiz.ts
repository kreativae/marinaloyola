"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, lessonProgress, lessons, modules, quizAttempts, quizQuestions } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { attemptView, gradeAttempt, parseQuestionBlocks, startAttempt, type QuestionResult } from "@/lib/quiz";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function courseIdOf(lessonId: number) {
  const [row] = await db
    .select({ courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row?.courseId ?? null;
}

async function refreshQuiz(lessonId: number) {
  const courseId = await courseIdOf(lessonId);
  if (courseId) {
    revalidatePath(`/admin/cursos/${courseId}`);
    revalidatePath(`/admin/cursos/${courseId}/quiz/${lessonId}`);
  }
}

/* ------------------------------- ALUNA ---------------------------------- */

export async function startQuiz(lessonId: number): Promise<{ error?: string }> {
  const user = await requireUser();
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.type !== "quiz") return { error: "Quiz não encontrado." };
  if (user.role === "student") {
    const courseId = await courseIdOf(lesson.id);
    const [enrolled] = courseId
      ? await db
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId)))
          .limit(1)
      : [];
    if (!enrolled) return { error: "Não está inscrita neste curso." };
  }
  try {
    await startAttempt(user.id, lesson);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  return {};
}

export async function submitQuiz(
  attemptId: number,
  answers: Record<string, number>
): Promise<{ error?: string; score?: number; passed?: boolean; results?: QuestionResult[] }> {
  const user = await requireUser();
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)))
    .limit(1);
  if (!attempt) return { error: "Tentativa não encontrada." };
  if (attempt.submittedAt) return { error: "Esta tentativa já foi entregue." };
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, attempt.lessonId)).limit(1);
  if (!lesson) return { error: "Quiz não encontrado." };

  const graded = await gradeAttempt(attempt, answers, lesson.quizMinScore);
  const [saved] = await db
    .update(quizAttempts)
    .set({ answers: graded.answers, score: graded.score, passed: graded.passed, submittedAt: new Date() })
    .where(eq(quizAttempts.id, attempt.id))
    .returning();
  if (graded.passed) {
    await db.insert(lessonProgress).values({ userId: user.id, lessonId: lesson.id }).onConflictDoNothing();
  }
  await refreshQuiz(lesson.id);
  const { results } = await attemptView(saved);
  return { score: graded.score, passed: graded.passed, results: results ?? [] };
}

/* ------------------------------- ADMIN ---------------------------------- */

export type QuestionFormResult = { ok: boolean; error?: string; savedAt?: number };

function readQuestion(fd: FormData) {
  const options = fd.getAll("option").map((o) => String(o).trim());
  const answerRaw = Number(fd.get("answer"));
  // Remove opções vazias mantendo a referência da opção certa
  const kept: string[] = [];
  let answer = -1;
  options.forEach((o, i) => {
    if (!o) return;
    if (i === answerRaw) answer = kept.length;
    kept.push(o);
  });
  return { question: str(fd, "question"), options: kept, answer, explanation: str(fd, "explanation") || null };
}

function validate(q: ReturnType<typeof readQuestion>) {
  if (!q.question) return "Escreva a pergunta.";
  if (q.options.length < 2) return "Indique pelo menos 2 opções.";
  if (q.answer < 0) return "Marque a opção certa.";
  return null;
}

export async function createQuestion(
  lessonId: number,
  _prev: QuestionFormResult | null,
  fd: FormData
): Promise<QuestionFormResult> {
  await requireAdmin();
  const q = readQuestion(fd);
  const err = validate(q);
  if (err) return { ok: false, error: err };
  const [row] = await db
    .select({ m: max(quizQuestions.order) })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lessonId));
  await db.insert(quizQuestions).values({ lessonId, ...q, order: (row?.m ?? 0) + 1 });
  await refreshQuiz(lessonId);
  return { ok: true, savedAt: Date.now() };
}

export async function updateQuestion(
  id: number,
  _prev: QuestionFormResult | null,
  fd: FormData
): Promise<QuestionFormResult> {
  await requireAdmin();
  const q = readQuestion(fd);
  const err = validate(q);
  if (err) return { ok: false, error: err };
  const [row] = await db.update(quizQuestions).set(q).where(eq(quizQuestions.id, id)).returning();
  if (row) await refreshQuiz(row.lessonId);
  return { ok: true, savedAt: Date.now() };
}

export async function toggleQuestion(id: number) {
  await requireAdmin();
  const [q] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).limit(1);
  if (!q) return;
  await db.update(quizQuestions).set({ active: !q.active }).where(eq(quizQuestions.id, id));
  await refreshQuiz(q.lessonId);
}

export async function deleteQuestion(id: number) {
  await requireAdmin();
  const [q] = await db.delete(quizQuestions).where(eq(quizQuestions.id, id)).returning();
  if (q) await refreshQuiz(q.lessonId);
}

export async function importQuestions(
  lessonId: number,
  _prev: { ok: boolean; message?: string } | null,
  fd: FormData
): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const { questions, errors } = parseQuestionBlocks(str(fd, "text"));
  if (!questions.length) return { ok: false, message: errors[0] ?? "Nada para importar." };
  const [row] = await db
    .select({ m: max(quizQuestions.order) })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lessonId));
  let order = row?.m ?? 0;
  await db.insert(quizQuestions).values(questions.map((q) => ({ lessonId, ...q, order: ++order })));
  await refreshQuiz(lessonId);
  return {
    ok: true,
    message: `${questions.length} questão(ões) importada(s).${errors.length ? ` Ignorados: ${errors.join(" ")}` : ""}`,
  };
}

export async function saveQuizSettings(
  lessonId: number,
  _prev: { ok: boolean; message?: string } | null,
  fd: FormData
): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const drawRaw = str(fd, "quizDraw");
  const draw = drawRaw ? Math.max(1, Math.round(Number(drawRaw))) : null;
  const min = Math.min(100, Math.max(0, Math.round(Number(str(fd, "quizMinScore")) || 0)));
  if (drawRaw && !Number.isFinite(Number(drawRaw))) return { ok: false, message: "Número de questões inválido." };
  await db
    .update(lessons)
    .set({
      title: str(fd, "title") || undefined,
      quizDraw: draw,
      quizMinScore: min,
      durationMin: Math.max(1, Number(str(fd, "durationMin")) || 10),
      content: str(fd, "content") || null,
    })
    .where(eq(lessons.id, lessonId));
  await refreshQuiz(lessonId);
  return { ok: true, message: "Definições guardadas." };
}
