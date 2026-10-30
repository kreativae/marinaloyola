"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  Loader2,
  Monitor,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { resetSitePage, saveSitePage, uploadSiteImage } from "@/lib/actions-site";
import { SITE_ICONS, type FieldValue, type SiteField, type SitePageDef, type SitePageId, type SectionValues } from "@/lib/site-def";
import { Field, IconInput } from "@/components/form-kit";
import { cn } from "@/lib/utils";

export type EditorData = {
  seo: { title: string; description: string };
  order: string[];
  hidden: string[];
  sections: Record<string, SectionValues>;
};

const iconBtn = "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-plum disabled:pointer-events-none disabled:opacity-30";

function move<T>(arr: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/* --------------------------------- EDITOR -------------------------------- */

export function SiteEditor({
  pages,
  page,
  initial,
  customized,
}: {
  pages: (SitePageDef & { edited: boolean })[];
  page: SitePageDef;
  initial: EditorData;
  customized: boolean;
}) {
  const [data, setData] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [open, setOpen] = useState<string | null>(page.sections[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [pending, start] = useTransition();
  const preview = useRef<PreviewHandle>(null);
  const dirty = useMemo(() => JSON.stringify(data) !== baseline, [data, baseline]);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveSitePage(page.id, data);
      if (!r.ok) return setError(r.error ?? "Não foi possível guardar.");
      setBaseline(JSON.stringify(data));
      setSavedAt(Date.now());
      preview.current?.reload();
    });

  const reset = () => {
    if (!confirm(`Voltar todo o conteúdo de “${page.label}” ao texto original? Isto não se pode desfazer.`)) return;
    start(async () => {
      await resetSitePage(page.id);
      window.location.reload();
    });
  };

  // ⌘S / Ctrl+S guarda; avisa antes de sair com alterações por guardar
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveRef.current();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty]);

  const setSection = (id: string, key: string, value: FieldValue) =>
    setData((d) => ({ ...d, sections: { ...d.sections, [id]: { ...d.sections[id], [key]: value } } }));

  const toggleOpen = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) preview.current?.scrollTo(next);
  };

  const sections = page.fixed ? page.sections : data.order.map((id) => page.sections.find((s) => s.id === id)!).filter(Boolean);

  return (
    <div>
      {/* Páginas */}
      <nav className="admin-scroll -mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {pages.map((p) => (
          <Link
            key={p.id}
            href={`/admin/site?p=${p.id}`}
            onClick={(e) => {
              if (dirty && p.id !== page.id && !confirm("Há alterações por guardar nesta página. Sair sem guardar?")) e.preventDefault();
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all",
              p.id === page.id ? "border-plum bg-plum text-white shadow-[0_8px_20px_-10px_rgb(128_0_128/0.8)]" : "border-line bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
            )}
          >
            {p.label}
            {p.edited && <span className={cn("h-1.5 w-1.5 rounded-full", p.id === page.id ? "bg-white" : "bg-plum")} title="Editada" />}
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
        <div className="min-w-0 space-y-4">
          {/* Cabeçalho da página */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="font-display text-xl text-zinc-950">{page.label}</p>
              <p className="text-[13px] text-zinc-500">{page.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={page.path} target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-2 !text-xs">
                <ExternalLink size={13} /> Ver página
              </a>
              {customized && (
                <button type="button" onClick={reset} disabled={pending} className="btn-ghost !px-4 !py-2 !text-xs hover:!text-rose-600">
                  <RotateCcw size={13} /> Repor original
                </button>
              )}
            </div>
          </div>

          {/* SEO */}
          {page.seo && <SeoCard seo={data.seo} path={page.path} onChange={(seo) => setData((d) => ({ ...d, seo }))} />}

          {/* Blocos */}
          {sections.map((sec, i) => {
            const hidden = data.hidden.includes(sec.id);
            const isOpen = open === sec.id;
            return (
              <section
                key={sec.id}
                className={cn(
                  "overflow-hidden rounded-[22px] border bg-white transition-all duration-300",
                  isOpen ? "border-plum/30 shadow-[0_20px_50px_-30px_rgb(128_0_128/0.45)]" : "border-line",
                  hidden && "opacity-60"
                )}
              >
                <header className="flex items-center gap-3 px-5 py-3.5">
                  <button type="button" onClick={() => toggleOpen(sec.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-colors",
                        isOpen ? "bg-plum text-white" : "bg-plum/[0.08] text-plum"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-900">
                        {sec.label}
                        {hidden && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Escondido</span>}
                      </span>
                      {sec.description && <span className="block truncate text-xs text-zinc-500">{sec.description}</span>}
                    </span>
                  </button>
                  {!page.fixed && (
                    <span className="flex shrink-0 items-center">
                      <button type="button" disabled={i === 0} onClick={() => setData((d) => ({ ...d, order: move(d.order, i, -1) }))} className={iconBtn} title="Subir bloco">
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={i === sections.length - 1}
                        onClick={() => setData((d) => ({ ...d, order: move(d.order, i, 1) }))}
                        className={iconBtn}
                        title="Descer bloco"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setData((d) => ({ ...d, hidden: hidden ? d.hidden.filter((x) => x !== sec.id) : [...d.hidden, sec.id] }))}
                        className={iconBtn}
                        title={hidden ? "Mostrar no site" : "Esconder do site"}
                      >
                        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </span>
                  )}
                  <button type="button" onClick={() => toggleOpen(sec.id)} className={iconBtn} aria-label={isOpen ? "Fechar" : "Editar"}>
                    <ChevronDown size={16} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
                  </button>
                </header>
                {isOpen && (
                  <div className="grid animate-fade-in gap-4 border-t border-line bg-zinc-50/40 px-5 py-5 sm:grid-cols-2">
                    {sec.fields.map((f) => (
                      <FieldInput key={f.key} field={f} value={data.sections[sec.id]?.[f.key]} onChange={(v) => setSection(sec.id, f.key, v)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="xl:sticky xl:top-24">
          <Preview ref={preview} path={page.path} />
        </div>
      </div>

      {/* Barra de gravação */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-500 ease-[var(--ease-out-soft)]",
          dirty || pending || error ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        )}
      >
        <div className="flex max-w-xl flex-1 flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", error ? "bg-rose-400" : "animate-pulse bg-amber-400")} />
          <span className="min-w-0 flex-1 text-sm">{error ?? "Alterações por guardar"}</span>
          <button
            type="button"
            onClick={() => {
              setData(JSON.parse(baseline));
              setError(null);
            }}
            disabled={pending}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Descartar
          </button>
          <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-plum px-4 py-2 text-xs font-bold text-white hover:bg-plum-bright disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium sm:inline">⌘S</kbd>
          </button>
        </div>
      </div>
      {savedAt > 0 && !dirty && !pending && (
        <div key={savedAt} className="pop fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          <Check size={14} /> Publicado no site
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- SEO ---------------------------------- */

function SeoCard({ seo, path, onChange }: { seo: EditorData["seo"]; path: string; onChange: (s: EditorData["seo"]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-[22px] border border-line bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <Search size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">Google e partilhas (SEO)</span>
          <span className="block truncate text-xs text-zinc-500">{seo.title || "Título por omissão do site"}</span>
        </span>
        <ChevronDown size={16} className={cn("text-zinc-400 transition-transform duration-300", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-fade-in space-y-4 border-t border-line bg-zinc-50/40 px-5 py-5">
          <Field label="Título" hint={`${seo.title.length}/60 caracteres recomendados`}>
            <input value={seo.title} onChange={(e) => onChange({ ...seo, title: e.target.value })} maxLength={120} className="field" placeholder="Marina Loyola — Design, Mentoria & Formação" />
          </Field>
          <Field label="Descrição" hint={`${seo.description.length}/160 caracteres recomendados`}>
            <textarea value={seo.description} onChange={(e) => onChange({ ...seo, description: e.target.value })} maxLength={320} rows={3} className="field resize-y" />
          </Field>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] text-emerald-700">marinaloyola.com{path === "/" ? "" : path}</p>
            <p className="mt-0.5 truncate text-[17px] text-[#1a0dab]">{seo.title ? `${seo.title} · Marina Loyola` : "Marina Loyola — Design, Mentoria & Formação"}</p>
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-zinc-600">{seo.description || "Descrição por omissão do site."}</p>
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------- CAMPOS -------------------------------- */

function FieldInput({ field: f, value, onChange }: { field: SiteField; value: FieldValue | undefined; onChange: (v: FieldValue) => void }) {
  const wide = !f.half || f.type === "list" || f.type === "strings" || f.type === "image";
  const str = typeof value === "string" ? value : "";
  let input: React.ReactNode;
  switch (f.type) {
    case "title":
      input = <textarea value={str} onChange={(e) => onChange(e.target.value)} rows={Math.max(2, str.split("\n").length)} className="field resize-y font-display !text-lg leading-snug" />;
      break;
    case "textarea":
      input = <textarea value={str} onChange={(e) => onChange(e.target.value)} rows={Math.min(10, Math.max(3, Math.ceil(str.length / 70)))} className="field resize-y leading-relaxed" />;
      break;
    case "url":
      input = (
        <IconInput icon={Link2}>
          <input value={str} onChange={(e) => onChange(e.target.value)} className="field" placeholder="/agendar" />
        </IconInput>
      );
      break;
    case "image":
      input = <ImageInput value={str} onChange={onChange} />;
      break;
    case "icon":
      input = <IconPicker value={str} onChange={onChange} />;
      break;
    case "toggle":
      return (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 sm:col-span-2">
          <input type="checkbox" checked={str === "1"} onChange={(e) => onChange(e.target.checked ? "1" : "0")} className="peer sr-only" />
          <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-plum peer-checked:after:translate-x-4" />
          <span className="text-sm font-semibold text-zinc-800">{f.label}</span>
        </label>
      );
    case "strings":
      input = <StringsInput value={Array.isArray(value) ? (value as string[]) : []} item={f.item ?? "item"} onChange={onChange} />;
      break;
    case "list":
      input = <ListInput field={f} value={Array.isArray(value) ? (value as Record<string, string>[]) : []} onChange={onChange} />;
      break;
    default:
      input = <input value={str} onChange={(e) => onChange(e.target.value)} className="field" />;
  }
  return (
    <Field label={f.label} hint={f.hint} className={wide ? "sm:col-span-2" : undefined}>
      {input}
    </Field>
  );
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      setError(null);
      const r = await uploadSiteImage(fd);
      if (r.ok && r.url) onChange(r.url);
      else setError(r.error ?? "Falha no envio.");
    });
  };
  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-3 transition-colors hover:border-plum/40"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) upload(file);
      }}
    >
      <div className="relative flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={22} className="text-zinc-400" />
        )}
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 size={18} className="animate-spin text-plum" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={pending} className="btn-ghost !px-4 !py-2 !text-xs">
          <ImagePlus size={13} /> {value ? "Trocar foto" : "Enviar foto"}
        </button>
        <p className="text-[11.5px] text-zinc-400">Arraste uma imagem para aqui · JPG, PNG ou WEBP até 8 MB</p>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="field !py-1.5 !text-xs" placeholder="ou cole um link https://…" />
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(SITE_ICONS).map(([k, Icon]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
            value === k ? "border-plum bg-plum text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-500 hover:border-plum/40 hover:text-plum"
          )}
          title={k}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

function StringsInput({ value, item, onChange }: { value: string[]; item: string; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-zinc-400">{i + 1}</span>
          <input value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} className="field !py-2" />
          <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, -1))} className={iconBtn} title="Subir">
            <ArrowUp size={13} />
          </button>
          <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))} className={iconBtn} title="Descer">
            <ArrowDown size={13} />
          </button>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")} title="Remover">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <AddButton label={item} onClick={() => onChange([...value, ""])} />
    </div>
  );
}

function ListInput({ field, value, onChange }: { field: SiteField; value: Record<string, string>[]; onChange: (v: Record<string, string>[]) => void }) {
  const subs = field.fields ?? [];
  const blank = () => Object.fromEntries(subs.map((s) => [s.key, s.type === "icon" ? "sparkles" : ""]));
  const titleOf = (it: Record<string, string>) => it.title || it.label || it.name || it.q || it.t || it.value || it.year || "";
  return (
    <div className="space-y-3">
      {value.map((it, i) => (
        <div key={i} className="rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-bold tabular-nums text-zinc-500">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-700">{titleOf(it) || <span className="text-zinc-400">Sem título</span>}</span>
            <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, -1))} className={iconBtn} title="Subir">
              <ArrowUp size={13} />
            </button>
            <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))} className={iconBtn} title="Descer">
              <ArrowDown size={13} />
            </button>
            <button type="button" onClick={() => onChange([...value.slice(0, i + 1), { ...it }, ...value.slice(i + 1)])} className={iconBtn} title="Duplicar">
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => confirm(`Remover este ${field.item ?? "item"}?`) && onChange(value.filter((_, j) => j !== i))}
              className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
              title="Remover"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {subs.map((s) => (
              <FieldInput key={s.key} field={s} value={it[s.key] ?? ""} onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, [s.key]: String(v) } : x)))} />
            ))}
          </div>
        </div>
      ))}
      <AddButton label={field.item ?? "item"} onClick={() => onChange([...value, blank()])} />
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-plum/40 hover:text-plum"
    >
      <Plus size={14} /> Adicionar {label}
    </button>
  );
}

/* ---------------------------- PRÉ-VISUALIZAÇÃO ---------------------------- */

type PreviewHandle = { reload: () => void; scrollTo: (id: string) => void };

function Preview({ path, ref }: { path: string; ref: React.Ref<PreviewHandle> }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [version, setVersion] = useState(0);
  const [width, setWidth] = useState(600);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const target = useRef<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scrollFrame = (id: string | null) => {
    const doc = frame.current?.contentDocument;
    if (!doc || !id) return;
    const el = doc.getElementById(`bloco-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (id === "footer") doc.documentElement.scrollTo({ top: doc.documentElement.scrollHeight, behavior: "smooth" });
    else if (id === "header") doc.documentElement.scrollTo({ top: 0, behavior: "smooth" });
  };

  useImperativeHandle(ref, () => ({
    reload: () => setTimeout(() => setVersion((v) => v + 1), 250),
    scrollTo: (id) => {
      target.current = id;
      scrollFrame(id);
    },
  }));

  const frameW = device === "desktop" ? 1280 : 390;
  const scale = Math.min(1, width / frameW);
  const height = 640;

  return (
    <div className="rounded-[22px] border border-line bg-white p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-lg bg-zinc-100 px-3 py-1 text-center text-[11px] text-zinc-500">marinaloyola.com{path === "/" ? "" : path}</span>
        <div className="flex rounded-lg bg-zinc-100 p-0.5">
          {(
            [
              ["desktop", Monitor],
              ["mobile", Smartphone],
            ] as const
          ).map(([d, Icon]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={cn("rounded-md p-1.5 transition-colors", device === d ? "bg-white text-plum shadow-sm" : "text-zinc-400 hover:text-zinc-700")}
              title={d === "desktop" ? "Computador" : "Telemóvel"}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setVersion((v) => v + 1)} className="rounded-md p-1.5 text-zinc-400 hover:text-plum" title="Actualizar">
          <RotateCw size={13} />
        </button>
      </div>
      <div ref={box} className="relative overflow-hidden rounded-2xl border border-line bg-zinc-50" style={{ height }}>
        <iframe
          ref={frame}
          key={`${version}-${device}-${path}`}
          src={path}
          title="Pré-visualização do site"
          onLoad={() => setTimeout(() => scrollFrame(target.current), 300)}
          className="absolute left-1/2 top-0 origin-top bg-white"
          style={{ width: frameW, height: height / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      </div>
      <p className="mt-2 px-1 text-center text-[11px] text-zinc-400">A pré-visualização actualiza depois de guardar · ao abrir um bloco, a página vai até ele</p>
    </div>
  );
}
