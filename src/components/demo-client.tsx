"use client";

import { useState, useTransition } from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { addDemoDataAction, removeDemoDataAction } from "@/lib/actions-demo";

export function DemoPanel({ when, counts }: { when: string | null; counts: { label: string; count: number }[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const add = () =>
    start(async () => {
      const r = await addDemoDataAction();
      setMessage(r.error ? { tone: "error", text: r.error } : { tone: "ok", text: "Dados de demonstração adicionados." });
    });
  const remove = () => {
    if (!confirm("Excluir todos os dados de demonstração? Esta acção não pode ser desfeita.")) return;
    start(async () => {
      const r = await removeDemoDataAction();
      if (r.error) return setMessage({ tone: "error", text: r.error });
      setMessage({
        tone: "ok",
        text: r.kept
          ? `Dados excluídos. ${r.kept} contacto(s) mesclado(s) ficaram na plataforma, para não apagar dados reais.`
          : "Dados de demonstração excluídos.",
      });
    });
  };

  return (
    <div>
      {when ? (
        <>
          <p className="text-sm text-zinc-600">Adicionados em {when}.</p>
          <ul className="mt-4 grid gap-x-8 gap-y-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 sm:grid-cols-2">
            {counts.map((c) => (
              <li key={c.label} className="flex justify-between gap-4">
                <span>{c.label}</span>
                <strong className="text-zinc-950">{c.count}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-zinc-600">
          Sem dados de demonstração. Ao adicionar, a plataforma recebe contactos, conversas de WhatsApp, negócios no Pipeline, notas, eventos, agendamentos, pagamentos, despesas e publicações de Marketing.
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {when ? (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir dados de demonstração
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={add} className="btn-primary !px-6 !py-2.5 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Adicionar dados de demonstração
          </button>
        )}
        {message && (
          <p role="status" className={message.tone === "ok" ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-rose-700"}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
