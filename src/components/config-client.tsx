"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { CheckCircle2, FlaskConical, Loader2, RefreshCw, Save, XCircle } from "lucide-react";
import { regenerateCalendarFeed, saveServiceAction, testServiceAction, type SaveResult } from "@/lib/actions-config";
import type { FieldDef, ServiceDef } from "@/lib/services-def";
import { cn } from "@/lib/utils";

type Secrets = Record<string, { set: boolean; hint: string; fromEnv: boolean }>;

const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";

export function ServiceForm({
  service,
  values,
  secrets,
}: {
  service: ServiceDef;
  values: Record<string, string>;
  secrets: Secrets;
}) {
  const [state, action, saving] = useActionState<SaveResult | null, FormData>(
    saveServiceAction.bind(null, service.id),
    null
  );
  // Valores vivos de toggles e selects, para mostrar/esconder campos dependentes
  const [live, setLive] = useState<Record<string, string>>(values);
  const visible = (f: FieldDef) => !f.showIf || f.showIf.values.includes(live[f.showIf.key] ?? "");

  return (
    // Submissão manual: o React não limpa o formulário, por isso um erro de validação não apaga o
    // que foi escrito. Depois de guardar, a key nova remonta-o com os valores do servidor.
    <form
      key={state?.savedAt ?? "form"}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      {service.fields.map((f) => {
        const err = state?.errors?.[f.key];
        return (
          <div key={f.key} className={cn(!visible(f) && "hidden")}>
            {f.type === "toggle" ? (
              <Toggle
                name={f.key}
                label={f.label}
                defaultChecked={values[f.key] === "1"}
                onChange={(on) => setLive((l) => ({ ...l, [f.key]: on ? "1" : "0" }))}
              />
            ) : (
              <>
                <label htmlFor={`f-${f.key}`} className={labelCls}>
                  {f.label}
                </label>
                <FieldInput
                  field={f}
                  value={values[f.key]}
                  secret={secrets[f.key]}
                  invalid={Boolean(err)}
                  onChange={(v) => setLive((l) => ({ ...l, [f.key]: v }))}
                />
              </>
            )}
            {err ? (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{err}</p>
            ) : (
              f.help && <p className={cn("mt-1.5 text-xs leading-relaxed text-zinc-500", f.type === "toggle" && "pl-12")}>{f.help}</p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5">
        <button type="submit" disabled={saving} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
        {service.testable && <TestButton id={service.id} label={service.testLabel ?? "Testar"} />}
        {state?.message && !saving && (
          <p
            className={cn(
              "animate-fade-in text-xs font-semibold",
              state.ok ? "text-emerald-700" : "text-rose-600"
            )}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function FieldInput({
  field: f,
  value,
  secret,
  invalid,
  onChange,
}: {
  field: FieldDef;
  value?: string;
  secret?: Secrets[string];
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  const cls = cn("field", invalid && "!border-rose-400 focus:!ring-rose-200");
  const common = { id: `f-${f.key}`, name: f.key, className: cls };

  if (f.type === "select") {
    return (
      <select {...common} defaultValue={value} onChange={(e) => onChange(e.target.value)}>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (f.type === "textarea") {
    return <textarea {...common} rows={6} defaultValue={value} placeholder={f.placeholder} className={cn(cls, "resize-y font-mono !text-[13px] leading-relaxed")} />;
  }
  if (f.type === "secret") {
    return (
      <>
        <input
          {...common}
          type="password"
          autoComplete="new-password"
          placeholder={secret?.set ? `Guardada (${secret.hint}) — deixe vazio para manter` : f.placeholder ?? "Não definida"}
        />
        {secret?.set && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {secret.fromEnv ? (
              <span>Definida na variável de ambiente {f.env}.</span>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" name={`clear_${f.key}`} value="1" className="accent-plum" /> Remover valor guardado
              </label>
            )}
          </div>
        )}
      </>
    );
  }
  return (
    <input
      {...common}
      type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
      min={f.min}
      max={f.max}
      defaultValue={value}
      placeholder={f.placeholder}
    />
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:bg-plum peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-plum/30" />
      <span className="text-sm font-medium text-zinc-800">{label}</span>
    </label>
  );
}

function TestButton({ id, label }: { id: ServiceDef["id"]; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            setResult(await testServiceAction(id));
          })
        }
        className="btn-ghost !px-5 !py-2.5 !text-xs disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} {label}
      </button>
      {result && (
        <p
          className={cn(
            "flex w-full animate-fade-in items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed",
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {result.ok ? <CheckCircle2 size={15} className="mt-px shrink-0" /> : <XCircle size={15} className="mt-px shrink-0" />}
          {result.message}
        </p>
      )}
    </>
  );
}

export function RegenerateFeedButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Gerar um novo endereço? O endereço actual deixa de funcionar e terá de o voltar a adicionar no Google Calendar.")) {
          start(() => regenerateCalendarFeed());
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
    >
      <RefreshCw size={13} className={cn(pending && "animate-spin")} /> Gerar novo
    </button>
  );
}
