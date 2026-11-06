"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { countFormView, submitForm, type SubmitResult } from "@/lib/actions-forms";
import type { PublicFormData } from "@/lib/forms";
import type { FormField } from "@/lib/forms-def";
import { cn } from "@/lib/utils";

const labelCls = "mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500";
const choiceCls = "flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700";

/** Um campo do formulário. Também é usado na pré-visualização do editor, com `preview`. */
export function FieldInput({ field: f, error, preview }: { field: FormField; error?: string; preview?: boolean }) {
  const name = `f_${f.id}`;
  const options = f.options.map((o) => o.trim()).filter(Boolean);
  const common = { name, placeholder: f.placeholder || undefined, required: f.required && !preview, "aria-invalid": !!error || undefined };
  const title = (
    <>
      {f.label}
      {f.required && " *"}
    </>
  );
  return (
    <div className={cn(f.width === "full" && "sm:col-span-2")}>
      {f.type === "consent" ? (
        <label className={cn(choiceCls, "items-start")}>
          <input type="checkbox" name={name} value="1" required={f.required && !preview} className="mt-0.5 h-4 w-4 shrink-0 accent-plum" />
          <span>{title}</span>
        </label>
      ) : (
        <>
          {f.type === "radio" || f.type === "checkbox" ? <p className={labelCls}>{title}</p> : <label htmlFor={`${name}-i`} className={labelCls}>{title}</label>}
          {f.type === "textarea" ? (
            <textarea id={`${name}-i`} rows={5} className="field resize-none" {...common} />
          ) : f.type === "select" ? (
            <select id={`${name}-i`} name={name} required={common.required} defaultValue="" className="field">
              <option value="" disabled={f.required} className="bg-white">
                {f.placeholder || "Escolha uma opção"}
              </option>
              {options.map((o) => (
                <option key={o} value={o} className="bg-white">
                  {o}
                </option>
              ))}
            </select>
          ) : f.type === "radio" || f.type === "checkbox" ? (
            <div className="space-y-2">
              {options.map((o) => (
                <label key={o} className={choiceCls}>
                  <input type={f.type} name={name} value={o} required={f.type === "radio" && common.required} className="h-4 w-4 accent-plum" />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <input
              id={`${name}-i`}
              type={f.type === "phone" ? "tel" : f.type}
              autoComplete={f.id === "name" ? "name" : f.id === "email" ? "email" : f.type === "phone" ? "tel" : undefined}
              className="field"
              {...common}
            />
          )}
        </>
      )}
      {f.help && <p className="mt-1.5 text-xs text-zinc-500">{f.help}</p>}
      {error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

/** De onde veio a visita: utm_source do link ou o site anterior. */
function originOf() {
  const utm = new URLSearchParams(location.search).get("utm_source");
  if (utm) return utm;
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    return host && host !== location.hostname ? host : "";
  } catch {
    return "";
  }
}

export function PublicForm({ form }: { form: PublicFormData }) {
  const [state, run, pending] = useActionState(
    (prev: SubmitResult | null, fd: FormData) => submitForm(form.id, prev, fd),
    null
  );
  // Antes de a página estar pronta, um envio iria pelo browser e punha os dados no URL
  const [ready, setReady] = useState(false);
  const counted = useRef(false);
  useEffect(() => {
    setReady(true);
    if (counted.current) return;
    counted.current = true;
    const key = `form-view-${form.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sem armazenamento: conta na mesma */
    }
    void countFormView(form.id);
  }, [form.id]);

  if (state?.ok) {
    const external = /^https?:/.test(form.successCtaHref);
    return (
      <div className="rounded-2xl border border-plum/40 bg-plum/[0.06] p-8 text-center">
        <p className="font-display text-3xl italic">{form.successTitle}</p>
        {form.successText && <p className="mx-auto mt-3 max-w-sm whitespace-pre-line text-sm text-zinc-600">{form.successText}</p>}
        {form.successCtaLabel && form.successCtaHref && (
          external ? (
            <a href={form.successCtaHref} target="_blank" rel="noreferrer" className="btn-primary mt-6">
              {form.successCtaLabel} <ArrowRight size={15} />
            </a>
          ) : (
            <Link href={form.successCtaHref} className="btn-primary mt-6">
              {form.successCtaLabel} <ArrowRight size={15} />
            </Link>
          )
        )}
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("origin", originOf());
        startTransition(() => run(fd));
      }}
      className="space-y-5"
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state?.error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{state.error}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        {form.fields.map((f) => (
          <FieldInput key={f.id} field={f} error={state?.errors?.[f.id]} />
        ))}
      </div>
      <button type="submit" disabled={pending || !ready} className="btn-primary w-full disabled:opacity-60 sm:w-auto">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {form.button}
      </button>
    </form>
  );
}
