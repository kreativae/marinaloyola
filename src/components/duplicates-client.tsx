"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Merge, X } from "lucide-react";
import { dismissDuplicateAction, mergeContactsAction } from "@/lib/actions-contacts";
import { cn } from "@/lib/utils";

/** Pede confirmação e junta `dropIds` em `keepId`; sem `onDone`, abre a ficha do contacto que ficou. */
export function MergeButton({
  keepId,
  dropIds,
  question,
  label = "Mesclar",
  onDone,
  className,
}: {
  keepId: number;
  dropIds: number[];
  question: string;
  label?: string;
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={cn("inline-flex items-center gap-1.5 disabled:opacity-60", className)}
        onClick={() => {
          if (!confirm(question)) return;
          setError(null);
          start(async () => {
            const r = await mergeContactsAction(keepId, dropIds);
            if (r.error) return setError(r.error);
            onDone?.();
            if (onDone) router.refresh();
            else router.push(`/admin/crm/${keepId}`);
          });
        }}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
        {label}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </>
  );
}

export function DismissDuplicateButton({ groupKey, className }: { groupKey: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => dismissDuplicateAction(groupKey))}
      className={cn("inline-flex items-center gap-1.5 disabled:opacity-60", className)}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
      Não é duplicado
    </button>
  );
}

export type DuplicateCardMember = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  when: string;
};

/** Um grupo de possíveis duplicados: escolhe-se a ficha que fica. */
export function DuplicateGroupCard({
  groupKey,
  reasons,
  members,
}: {
  groupKey: string;
  reasons: string[];
  members: DuplicateCardMember[];
}) {
  const [keepId, setKeepId] = useState(members[0].id);
  const keep = members.find((m) => m.id === keepId) ?? members[0];
  const others = members.filter((m) => m.id !== keep.id);
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <span key={r} className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
            {r}
          </span>
        ))}
      </div>
      <div className="grid gap-2">
        {members.map((m) => (
          <label
            key={m.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              m.id === keep.id ? "border-plum/40 bg-plum/5" : "border-zinc-200 hover:bg-zinc-50"
            )}
          >
            <input
              type="radio"
              name={`keep-${groupKey}`}
              checked={m.id === keep.id}
              onChange={() => setKeepId(m.id)}
              className="mt-1 accent-[#800080]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-zinc-900">
                {m.name}
                {m.id === keep.id && <span className="text-[11px] font-medium text-plum">Esta ficha fica</span>}
              </span>
              <span className="mt-0.5 block break-words text-xs text-zinc-600">
                {[m.email, m.phone].filter(Boolean).join(" · ") || "Sem email nem telefone"}
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                {m.source} · {m.status} · criado em {m.when}
              </span>
            </span>
            <Link
              href={`/admin/crm/${m.id}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-xs font-semibold text-plum hover:underline"
            >
              Ver ficha
            </Link>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <DismissDuplicateButton groupKey={groupKey} className="btn-ghost !px-5 !py-2.5 !text-xs" />
        <MergeButton
          keepId={keep.id}
          dropIds={others.map((m) => m.id)}
          question={`Mesclar ${others.map((m) => `“${m.name}”`).join(", ")} em “${keep.name}”? Fica uma só ficha com o histórico, as conversas, os pagamentos e os agendamentos de todos. Esta acção não pode ser desfeita.`}
          className="btn-primary !px-6 !py-2.5 !text-xs"
        />
      </div>
    </section>
  );
}
