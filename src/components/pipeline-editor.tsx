"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Layers, Loader2, Plus, Settings2, Trash2, Undo2 } from "lucide-react";
import { Field, FormSection, Modal, ModalFooter } from "@/components/form-kit";
import { deletePipelineAction, savePipelineAction, type StageInput } from "@/lib/actions-pipeline";
import { cn } from "@/lib/utils";

export type EditableStage = { id: number; name: string; color: string; deals: number };
type EditablePipeline = { id: string; label: string; stages: EditableStage[] };
type Row = { key: number; id: number | null; name: string; color: string; deals: number; removed: boolean; moveTo: number | null };

const STARTER = [
  { name: "Novo Lead", color: "#71717a" },
  { name: "Contactado", color: "#0ea5e9" },
  { name: "Proposta Enviada", color: "#f59e0b" },
];

function PipelineForm({ pipeline, onClose, canDelete }: { pipeline?: EditablePipeline; onClose: () => void; canDelete: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState(pipeline?.label ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    (pipeline?.stages ?? STARTER.map((s) => ({ ...s, id: null, deals: 0 }))).map((s, key) => ({ ...s, key, removed: false, moveTo: null }))
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const patch = (key: number, change: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const kept = rows.filter((r) => !r.removed);
  const targets = kept.filter((r) => r.id !== null);

  const move = (key: number, step: -1 | 1) =>
    setRows((list) => {
      const visible = list.filter((r) => !r.removed);
      const from = visible.findIndex((r) => r.key === key);
      const other = visible[from + step];
      if (!other) return list;
      const a = list.findIndex((r) => r.key === key);
      const b = list.findIndex((r) => r.key === other.key);
      const next = [...list];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  const remove = (row: Row) => {
    if (row.id === null) setRows((list) => list.filter((r) => r.key !== row.key));
    else patch(row.key, { removed: true, moveTo: null });
  };

  const add = () => {
    setRows((list) => [...list, { key: nextKey, id: null, name: "", color: "#800080", deals: 0, removed: false, moveTo: null }]);
    setNextKey((k) => k + 1);
  };

  const save = () =>
    start(async () => {
      const stages: StageInput[] = rows.map(({ id, name, color, removed, moveTo, deals }) => ({
        id,
        name,
        color,
        removed,
        moveTo: deals > 0 ? (targets.find((t) => t.id === moveTo)?.id ?? targets[0]?.id ?? null) : null,
      }));
      const r = await savePipelineAction(pipeline?.id ?? null, label, stages);
      if (!r.ok) return setError(r.error);
      onClose();
      if (pipeline) router.refresh();
      else router.push(`/admin/pipeline?p=${r.id}`);
    });

  const destroy = () =>
    start(async () => {
      const r = await deletePipelineAction(pipeline!.id);
      if (!r.ok) return setError(r.error);
      onClose();
      router.push("/admin/pipeline");
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Nome do pipeline" required className="mb-6">
        <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={60} placeholder="Ex: Consultoria" className="field" data-autofocus />
      </Field>

      <FormSection icon={Layers} title="Etapas">
        <ul className="space-y-2">
          {kept.map((r, i) => (
            <li key={r.key} className="flex items-center gap-2">
              <input
                type="color"
                value={r.color}
                onChange={(e) => patch(r.key, { color: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white p-0.5"
                aria-label={`Cor de ${r.name || "nova etapa"}`}
              />
              <input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} required maxLength={60} placeholder="Nome da etapa" className="field min-w-0 flex-1" />
              <span className="hidden w-5 shrink-0 text-center text-[11px] tabular-nums text-zinc-400 sm:inline" title="Negócios nesta etapa">
                {r.deals || ""}
              </span>
              <button type="button" onClick={() => move(r.key, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30" aria-label={`Subir ${r.name}`}>
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => move(r.key, 1)} disabled={i === kept.length - 1} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30" aria-label={`Descer ${r.name}`}>
                <ArrowDown size={14} />
              </button>
              <button type="button" onClick={() => remove(r)} disabled={kept.length === 1} className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label={`Apagar ${r.name}`}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={add} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-plum/30 hover:text-plum">
          <Plus size={14} /> Adicionar etapa
        </button>
      </FormSection>

      {rows.some((r) => r.removed) && (
        <FormSection icon={Trash2} title="Etapas a apagar">
          <ul className="space-y-2">
            {rows
              .filter((r) => r.removed)
              .map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50/60 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold text-zinc-800">{r.name}</span>
                  {r.deals > 0 && (
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      {r.deals} negócio(s) para
                      <select value={targets.find((t) => t.id === r.moveTo)?.id ?? targets[0]?.id ?? ""} onChange={(e) => patch(r.key, { moveTo: Number(e.target.value) })} className="field !w-auto !py-1.5 !text-xs">
                        {targets.map((t) => (
                          <option key={t.key} value={t.id ?? ""}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="button" onClick={() => patch(r.key, { removed: false })} className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
                    <Undo2 size={13} /> Manter
                  </button>
                </li>
              ))}
          </ul>
        </FormSection>
      )}

      <ModalFooter error={error}>
        {pipeline &&
          canDelete &&
          (confirming ? (
            <button type="button" onClick={destroy} disabled={pending} className="mr-auto rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700">
              Confirmar: apagar pipeline
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="mr-auto text-xs font-semibold text-rose-600 hover:underline">
              Apagar pipeline
            </button>
          ))}
        <button type="button" onClick={onClose} className="btn-ghost !px-4 !py-2.5 !text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className={cn("btn-primary !px-5 !py-2.5 !text-xs", pending && "opacity-60")}>
          {pending && <Loader2 size={14} className="animate-spin" />} Guardar
        </button>
      </ModalFooter>
    </form>
  );
}

export function EditPipelineButton({ pipeline, canDelete }: { pipeline: EditablePipeline; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost !px-4 !py-2 !text-xs">
        <Settings2 size={14} /> Editar pipeline
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar pipeline" description="Nome, etapas e ordem das colunas" icon={Settings2}>
        {open && <PipelineForm pipeline={pipeline} canDelete={canDelete} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

export function NewPipelineButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost !px-4 !py-2 !text-xs">
        <Plus size={14} /> Novo pipeline
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo pipeline" description="Comece por estas etapas e ajuste como quiser" icon={Layers}>
        {open && <PipelineForm canDelete={false} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
