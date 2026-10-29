"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ListChecks, Loader2, Play, Printer, RotateCcw } from "lucide-react";
import { completeLesson } from "@/lib/actions-admin";
import { startQuiz, submitQuiz } from "@/lib/actions-quiz";
import type { PublicQuestion, QuestionResult } from "@/lib/quiz";
import { cn } from "@/lib/utils";

export function CompleteButton({ lessonId, done }: { lessonId: number; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (done) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-700">
        <CheckCircle2 size={16} /> Aula concluída
      </span>
    );
  }
  return (
    <button
      onClick={() =>
        start(async () => {
          await completeLesson(lessonId);
          router.refresh();
        })
      }
      disabled={pending}
      className="btn-primary disabled:opacity-60"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      Marcar como concluída
    </button>
  );
}

/** Link de YouTube/Vimeo → URL de embed; null para ficheiros de vídeo directos. */
function embedUrl(src: string) {
  try {
    const u = new URL(src);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
    }
    if (host.endsWith("vimeo.com")) {
      if (host === "player.vimeo.com") return src;
      const [id, hash] = u.pathname.split("/").filter(Boolean);
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}` : null;
    }
  } catch {
    /* URL relativo: ficheiro directo */
  }
  return null;
}

export function VideoPlayer({
  src,
  lessonId,
  done,
  title,
}: {
  src: string;
  lessonId: number;
  done: boolean;
  title: string;
}) {
  const router = useRouter();
  const [finished, setFinished] = useState(done);
  const embed = embedUrl(src);
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      {embed ? (
        <iframe
          key={embed}
          src={embed}
          title={title}
          className="aspect-video w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      ) : (
        <video
          key={src}
          src={src}
          controls
          className="aspect-video w-full"
          onEnded={() => {
            if (finished) return;
            setFinished(true);
            void completeLesson(lessonId).then(() => router.refresh());
          }}
        />
      )}
      <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3">
        <p className="truncate text-sm font-medium text-zinc-600">{title}</p>
        {finished && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} /> Vista
          </span>
        )}
      </div>
      {!finished && !embed && (
        <p className="px-5 pb-4 text-[11px] text-zinc-500">
          A aula é marcada como concluída automaticamente no fim do vídeo.
        </p>
      )}
    </div>
  );
}

export type QuizAttemptView = {
  id: number;
  questions: PublicQuestion[];
  results: QuestionResult[] | null;
  score: number | null;
  passed: boolean | null;
};

export function QuizPlayer({
  lessonId,
  minScore,
  drawCount,
  poolSize,
  done,
  attempt,
  attemptsCount,
  bestScore,
}: {
  lessonId: number;
  minScore: number;
  drawCount: number;
  poolSize: number;
  done: boolean;
  attempt: QuizAttemptView | null;
  attemptsCount: number;
  bestScore: number | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState<{ score: number; passed: boolean; results: QuestionResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setError(null);
      const r = await startQuiz(lessonId);
      if (r.error) setError(r.error);
      setAnswers({});
      setGraded(null);
      router.refresh();
    });

  // Resultado: acabado de corrigir ou de uma tentativa já entregue
  const results = graded?.results ?? attempt?.results ?? null;
  const score = graded?.score ?? attempt?.score ?? null;
  const passed = graded?.passed ?? attempt?.passed ?? null;

  if (!attempt || poolSize === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center lg:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-plum/10 text-plum">
          <ListChecks size={24} />
        </span>
        <p className="mt-5 font-display text-2xl text-zinc-950">Pronta para o quiz?</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600">
          {poolSize === 0
            ? "Este quiz ainda não tem questões. Volte mais tarde."
            : `Vai responder a ${drawCount} questões sorteadas de um banco de ${poolSize}. Precisa de ${minScore}% para concluir a aula. Em cada nova tentativa as questões mudam.`}
        </p>
        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        {poolSize > 0 && (
          <button onClick={begin} disabled={pending} className="btn-primary mt-6 disabled:opacity-60">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Começar quiz
          </button>
        )}
      </div>
    );
  }

  const total = attempt.questions.length;
  const answered = Object.keys(answers).length;

  function submit() {
    start(async () => {
      setError(null);
      const r = await submitQuiz(attempt!.id, answers);
      if (r.error) {
        setError(r.error);
        router.refresh();
        return;
      }
      setGraded({ score: r.score!, passed: r.passed!, results: r.results! });
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-plum">
          Quiz · nota mínima {minScore}%
        </p>
        <p className="text-xs text-zinc-500">
          {results
            ? `Tentativa ${attemptsCount}${bestScore !== null ? ` · melhor nota ${bestScore}%` : ""}`
            : `${answered}/${total} respondidas`}
        </p>
      </div>

      {results && score !== null && (
        <div
          className={cn(
            "mb-8 animate-fade-in rounded-2xl border p-5 text-center",
            passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"
          )}
        >
          <p className="font-display text-4xl font-semibold text-zinc-950">{score}%</p>
          <p className="mt-1 text-sm text-zinc-600">
            {results.filter((r) => r.chosen === r.correct).length} de {results.length} certas ·{" "}
            {passed
              ? done
                ? "Aprovada — aula concluída."
                : "Parabéns! Quiz aprovado."
              : `Precisa de pelo menos ${minScore}%.`}
          </p>
          <button onClick={begin} disabled={pending} className="btn-ghost mt-4 !px-5 !py-2 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {passed ? "Refazer com novas questões" : "Tentar de novo com novas questões"}
          </button>
        </div>
      )}

      <div className="space-y-8">
        {attempt.questions.map((q, qi) => {
          const r = results?.find((x) => x.qid === q.qid);
          return (
            <div key={q.qid}>
              <p className="font-display text-lg text-zinc-950">
                {qi + 1}. {q.question}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const chosen = r ? r.chosen === oi : answers[q.qid] === oi;
                  const isCorrect = r && oi === r.correct;
                  const isWrong = r && chosen && oi !== r.correct;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!!r || pending}
                      onClick={() => setAnswers((a) => ({ ...a, [q.qid]: oi }))}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                        isCorrect
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                          : isWrong
                            ? "border-rose-500/60 bg-rose-500/10 text-rose-700"
                            : chosen
                              ? "border-plum bg-plum/10 text-zinc-950"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300",
                        r && "cursor-default"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {r?.explanation && (
                <p className="mt-3 rounded-xl bg-white px-4 py-3 text-xs leading-relaxed text-zinc-600">
                  <span className="font-semibold text-zinc-800">Porquê: </span>
                  {r.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-6 text-sm text-rose-600">{error}</p>}
      {!results && (
        <button
          onClick={submit}
          disabled={answered < total || pending}
          className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending && <Loader2 size={16} className="animate-spin" />} Entregar respostas
        </button>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print">
      <Printer size={16} /> Imprimir / Guardar em PDF
    </button>
  );
}
