import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizAttempts, quizQuestions, type QuizAttempt, type QuizQuestion } from "@/db/schema";

/**
 * Quizzes com banco de questões:
 *  - cada tentativa sorteia N questões do banco da aula;
 *  - o sorteio é equilibrado: primeiro as questões que a aluna ainda não viu e, entre essas,
 *    as menos usadas por todas as alunas — assim duas alunas seguidas recebem conjuntos diferentes;
 *  - a ordem das opções é baralhada por tentativa;
 *  - a correcção é feita no servidor: as respostas certas nunca são enviadas para o browser.
 */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function activeQuestions(lessonId: number) {
  return db
    .select()
    .from(quizQuestions)
    .where(and(eq(quizQuestions.lessonId, lessonId), eq(quizQuestions.active, true)))
    .orderBy(asc(quizQuestions.order), asc(quizQuestions.id));
}

/** Escolhe as questões de uma nova tentativa. */
export function drawQuestions(
  pool: QuizQuestion[],
  count: number,
  attempts: Pick<QuizAttempt, "userId" | "items">[],
  userId: number
) {
  const usage = new Map<number, number>();
  const seen = new Set<number>();
  for (const a of attempts) {
    for (const it of a.items) {
      usage.set(it.qid, (usage.get(it.qid) ?? 0) + 1);
      if (a.userId === userId) seen.add(it.qid);
    }
  }
  const ranked = pool
    .map((q) => ({ q, rank: (seen.has(q.id) ? 1e6 : 0) + (usage.get(q.id) ?? 0) + Math.random() }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, Math.min(count, pool.length))
    .map((r) => r.q);
  return shuffle(ranked).map((q) => ({ qid: q.id, order: shuffle(q.options.map((_, i) => i)) }));
}

export async function startAttempt(userId: number, lesson: { id: number; quizDraw: number | null }) {
  const [pool, attempts] = await Promise.all([
    activeQuestions(lesson.id),
    db
      .select({ userId: quizAttempts.userId, items: quizAttempts.items })
      .from(quizAttempts)
      .where(eq(quizAttempts.lessonId, lesson.id)),
  ]);
  if (!pool.length) throw new Error("Este quiz ainda não tem questões.");
  const items = drawQuestions(pool, lesson.quizDraw ?? pool.length, attempts, userId);
  const [row] = await db.insert(quizAttempts).values({ userId, lessonId: lesson.id, items }).returning();
  return row;
}

export async function latestAttempt(userId: number, lessonId: number) {
  const [row] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.lessonId, lessonId)))
    .orderBy(desc(quizAttempts.startedAt), desc(quizAttempts.id))
    .limit(1);
  return row ?? null;
}

/** Ordem mostrada: a baralhada no sorteio, com opções acrescentadas depois no fim. */
function shownOrder(order: number[], q: QuizQuestion) {
  return [...order, ...q.options.map((_, i) => i).filter((i) => !order.includes(i))].filter(
    (i) => i < q.options.length
  );
}

export type PublicQuestion = { qid: number; question: string; options: string[] };

export type QuestionResult = {
  qid: number;
  chosen: number | null; // índice mostrado
  correct: number; // índice mostrado da opção certa
  explanation: string | null;
};

/** Questões da tentativa na ordem e com as opções baralhadas — sem a resposta certa. */
export async function attemptView(attempt: QuizAttempt) {
  const rows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, attempt.lessonId));
  const byId = new Map(rows.map((q) => [q.id, q]));
  const questions: PublicQuestion[] = [];
  const results: QuestionResult[] = [];
  for (const it of attempt.items) {
    const q = byId.get(it.qid);
    if (!q) continue; // questão apagada depois do sorteio
    const order = shownOrder(it.order, q);
    questions.push({ qid: q.id, question: q.question, options: order.map((i) => q.options[i]) });
    if (attempt.submittedAt) {
      const chosenOriginal = attempt.answers?.[String(q.id)];
      results.push({
        qid: q.id,
        chosen: chosenOriginal === undefined ? null : order.indexOf(chosenOriginal),
        correct: order.indexOf(q.answer),
        explanation: q.explanation,
      });
    }
  }
  return { questions, results: attempt.submittedAt ? results : null };
}

/** Corrige a tentativa. `answers`: qid → índice mostrado à aluna. */
export async function gradeAttempt(attempt: QuizAttempt, answers: Record<string, number>, minScore: number) {
  const rows = await db.select().from(quizQuestions).where(eq(quizQuestions.lessonId, attempt.lessonId));
  const byId = new Map(rows.map((q) => [q.id, q]));
  const original: Record<string, number> = {};
  let total = 0;
  let correct = 0;
  for (const it of attempt.items) {
    const q = byId.get(it.qid);
    if (!q) continue;
    total++;
    const shown = answers[String(it.qid)];
    if (typeof shown !== "number") continue;
    const orig = shownOrder(it.order, q)[shown];
    if (orig === undefined) continue;
    original[String(it.qid)] = orig;
    if (orig === q.answer) correct++;
  }
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { answers: original, score, passed: score >= minScore, correct, total };
}

/* ------------------------- importação em texto -------------------------- */

/**
 * Formato de colagem rápida (uma questão por bloco, separados por linha vazia):
 *   Qual é a pergunta?
 *   * opção certa
 *   - opção errada
 *   - opção errada
 *   > explicação (opcional)
 */
export function parseQuestionBlocks(text: string) {
  const out: { question: string; options: string[]; answer: number; explanation: string | null }[] = [];
  const errors: string[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  blocks.forEach((block, bi) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const question = lines.find((l) => !/^[*\->]/.test(l))?.replace(/^\d+[.)]\s*/, "") ?? "";
    const options: string[] = [];
    let answer = -1;
    const expl: string[] = [];
    for (const l of lines) {
      if (l.startsWith("*")) {
        answer = options.length;
        options.push(l.slice(1).trim());
      } else if (l.startsWith("-")) options.push(l.slice(1).trim());
      else if (l.startsWith(">")) expl.push(l.slice(1).trim());
    }
    if (!question || options.length < 2 || answer < 0) {
      errors.push(`Bloco ${bi + 1}: precisa de uma pergunta, pelo menos 2 opções e uma marcada com *.`);
      return;
    }
    out.push({ question, options, answer, explanation: expl.join(" ") || null });
  });
  return { questions: out, errors };
}
