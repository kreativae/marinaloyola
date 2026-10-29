"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  createQuestion,
  deleteQuestion,
  importQuestions,
  saveQuizSettings,
  toggleQuestion,
  updateQuestion,
  type QuestionFormResult,
} from "@/lib/actions-quiz";
import { cn } from "@/lib/utils";

const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";

export type QuestionData = {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string | null;
  active: boolean;
  shown: number;
  accuracy: number | null;
};

/* --------------------------- formulário de questão ---------------------------- */

function QuestionForm({
  initial,
  action,
  onDone,
  submitLabel,
}: {
  initial?: Pick<QuestionData, "question" | "options" | "answer" | "explanation">;
  action: (prev: QuestionFormResult | null, fd: FormData) => Promise<QuestionFormResult>;
  onDone?: () => void;
  submitLabel: string;
}) {
  const [options, setOptions] = useState<string[]>(initial?.options ?? ["", "", "", ""]);
  const [answer, setAnswer] = useState(initial?.answer ?? 0);
  const [state, run, pending] = useActionState(async (prev: QuestionFormResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) {
      onDone?.();
      if (!initial) {
        setOptions(["", "", "", ""]);
        setAnswer(0);
      }
    }
    return r;
  }, null);

  return (
    <form
      // Remonta depois de criar, para limpar os campos
      key={initial ? "edit" : (state?.savedAt ?? "new")}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelCls}>Pergunta</label>
        <textarea name="question" required rows={2} defaultValue={initial?.question} className="field resize-y" />
      </div>
      <div>
        <label className={labelCls}>Opções — marque a certa</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <label
                className={cn(
                  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                  answer === i ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-zinc-200 text-zinc-300 hover:text-zinc-500"
                )}
                title="Opção certa"
              >
                <input type="radio" name="answer" value={i} checked={answer === i} onChange={() => setAnswer(i)} className="sr-only" />
                <CheckCircle2 size={16} />
              </label>
              <input
                name="option"
                value={opt}
                onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder={`Opção ${i + 1}`}
                className="field"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setOptions((o) => o.filter((_, j) => j !== i));
                    setAnswer((a) => (a === i ? 0 : a > i ? a - 1 : a));
                  }}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
                  aria-label="Remover opção"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button
            type="button"
            onClick={() => setOptions((o) => [...o, ""])}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-plum hover:underline"
          >
            <Plus size={13} /> Adicionar opção
          </button>
        )}
      </div>
      <div>
        <label className={labelCls}>Explicação (mostrada depois de entregar)</label>
        <input name="explanation" defaultValue={initial?.explanation ?? ""} className="field" placeholder="Opcional" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {submitLabel}
        </button>
        {onDone && initial && (
          <button type="button" onClick={onDone} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
            Cancelar
          </button>
        )}
        {state?.error && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}
        {state?.ok && !initial && <p className="animate-fade-in text-xs font-semibold text-emerald-700">Questão adicionada.</p>}
      </div>
    </form>
  );
}

export function NewQuestionForm({ lessonId }: { lessonId: number }) {
  return <QuestionForm action={createQuestion.bind(null, lessonId)} submitLabel="Adicionar questão" />;
}

/* ------------------------------ lista do banco -------------------------------- */

export function QuestionCard({ q, index }: { q: QuestionData; index: number }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const letters = "ABCDEF";

  return (
    <li className={cn("rounded-xl border bg-white p-4 transition-opacity", q.active ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-60")}>
      {editing ? (
        <QuestionForm
          initial={q}
          action={updateQuestion.bind(null, q.id)}
          onDone={() => setEditing(false)}
          submitLabel="Guardar"
        />
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-bold text-zinc-500">
              {index}
            </span>
            <p className="min-w-0 flex-1 text-sm font-semibold text-zinc-950">{q.question}</p>
            <div className="flex shrink-0 items-center gap-0.5">
              <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-plum" aria-label="Editar">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => start(() => toggleQuestion(q.id))}
                disabled={pending}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label={q.active ? "Desactivar" : "Activar"}
                title={q.active ? "Desactivar (deixa de ser sorteada)" : "Activar"}
              >
                {q.active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={() => confirm("Apagar esta questão?") && start(() => deleteQuestion(q.id))}
                disabled={pending}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Apagar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <ul className="mt-3 grid gap-1.5 pl-9 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                  i === q.answer ? "bg-emerald-50 font-semibold text-emerald-800" : "text-zinc-600"
                )}
              >
                <span className="font-bold opacity-60">{letters[i]}</span> {o}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-9 text-[11px] text-zinc-500">
            <span>Sorteada {q.shown}×</span>
            {q.accuracy !== null && (
              <span className={cn(q.accuracy < 50 && "font-semibold text-amber-700")}>
                {q.accuracy}% de acertos{q.accuracy < 50 ? " — talvez difícil ou ambígua" : ""}
              </span>
            )}
            {q.explanation && <span className="truncate">Explicação: {q.explanation}</span>}
            {!q.active && <span className="font-semibold">Desactivada</span>}
          </div>
        </>
      )}
    </li>
  );
}

/* ------------------------------ importação ----------------------------------- */

export function ImportQuestionsForm({ lessonId }: { lessonId: number }) {
  const [state, run, pending] = useActionState(importQuestions.bind(null, lessonId), null);
  return (
    <form action={run} className="space-y-3">
      <textarea
        name="text"
        rows={9}
        required
        className="field resize-y font-mono !text-xs leading-relaxed"
        placeholder={"Qual é o primeiro passo de um projeto de identidade?\n* Diagnóstico e estratégia\n- Escolher a tipografia\n- Desenhar o logótipo\n> Sem estratégia, o visual não tem critério.\n\nPróxima pergunta…\n* certa\n- errada"}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-ghost !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar
        </button>
        {state?.message && (
          <p className={cn("text-xs font-semibold", state.ok ? "text-emerald-700" : "text-rose-600")}>{state.message}</p>
        )}
      </div>
    </form>
  );
}

/* ------------------------------ definições ----------------------------------- */

export function QuizSettingsForm({
  lessonId,
  title,
  durationMin,
  draw,
  minScore,
  content,
  poolSize,
}: {
  lessonId: number;
  title: string;
  durationMin: number;
  draw: number | null;
  minScore: number;
  content: string | null;
  poolSize: number;
}) {
  const [state, run, pending] = useActionState(saveQuizSettings.bind(null, lessonId), null);
  const [drawVal, setDrawVal] = useState(draw ? String(draw) : "");
  const n = Number(drawVal) || poolSize;
  return (
    <form action={run} className="space-y-4">
      <div>
        <label className={labelCls}>Título</label>
        <input name="title" defaultValue={title} className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Questões por aluna</label>
          <input
            name="quizDraw"
            type="number"
            min={1}
            value={drawVal}
            onChange={(e) => setDrawVal(e.target.value)}
            placeholder={`Todas (${poolSize})`}
            className="field"
          />
        </div>
        <div>
          <label className={labelCls}>Nota mínima (%)</label>
          <input name="quizMinScore" type="number" min={0} max={100} defaultValue={minScore} className="field" />
        </div>
        <div>
          <label className={labelCls}>Duração (min)</label>
          <input name="durationMin" type="number" min={1} defaultValue={durationMin} className="field" />
        </div>
      </div>
      <p className="rounded-xl bg-plum/[0.06] px-4 py-3 text-xs leading-relaxed text-zinc-700">
        {poolSize === 0
          ? "Adicione questões ao banco para activar o quiz."
          : n >= poolSize
            ? `Todas as alunas respondem às ${poolSize} questões (em ordem e opções baralhadas). Para variar entre alunas, sorteie menos questões do que as do banco.`
            : `Cada aluna recebe ${n} de ${poolSize} questões. O sorteio dá prioridade às questões menos usadas, por isso alunas diferentes recebem conjuntos diferentes, e numa nova tentativa a aluna vê primeiro questões que ainda não viu.`}
      </p>
      <div>
        <label className={labelCls}>Instruções para a aluna</label>
        <textarea name="content" rows={2} defaultValue={content ?? ""} className="field resize-y" placeholder="Opcional" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
        {state?.message && (
          <p className={cn("text-xs font-semibold", state.ok ? "text-emerald-700" : "text-rose-600")}>{state.message}</p>
        )}
      </div>
    </form>
  );
}
