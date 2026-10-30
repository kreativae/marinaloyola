"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageIcon, Link2, Loader2, Pencil, Plus, RotateCw, Save, Sparkles, Trash2 } from "lucide-react";
import { Modal } from "@/components/contacts-client";
import { deleteBioLink, moveBioLink, saveBioLink, saveBioProfile, toggleBioLink, type BioResult } from "@/lib/actions-bio";
import { cn, num } from "@/lib/utils";

const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";
const iconBtn = "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-plum disabled:pointer-events-none disabled:opacity-30";

/** Avisa o pré-visualizador para recarregar depois de gravar. */
const notifySaved = () => window.dispatchEvent(new Event("bio-saved"));

function useBioForm(action: (prev: BioResult | null, fd: FormData) => Promise<BioResult>, onDone?: () => void) {
  const [state, run, pending] = useActionState(async (prev: BioResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) {
      notifySaved();
      onDone?.();
    }
    return r;
  }, null);
  return {
    state,
    pending,
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => run(fd));
    },
  };
}

/* -------------------------------- PERFIL --------------------------------- */

export function BioProfileForm({ values }: { values: Record<string, string> }) {
  const { state, pending, onSubmit } = useBioForm(saveBioProfile);
  const toggles = [
    ["bio_show_booking", "Mostrar agendamento com próximas vagas"],
    ["bio_show_courses", "Mostrar cursos publicados"],
    ["bio_show_newsletter", "Mostrar inscrição na newsletter"],
  ] as const;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Nome</label>
          <input name="bio_name" defaultValue={values.bio_name} className="field" />
        </div>
        <div>
          <label className={label}>Instagram</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">@</span>
            <input name="bio_instagram" defaultValue={values.bio_instagram} className="field !pl-8" />
          </div>
        </div>
      </div>
      <div>
        <label className={label}>Frase de assinatura</label>
        <input name="bio_tagline" defaultValue={values.bio_tagline} className="field" />
      </div>
      <div>
        <label className={label}>Apresentação</label>
        <textarea name="bio_about" rows={2} defaultValue={values.bio_about} className="field resize-y" />
      </div>
      <div>
        <label className={label}>Foto (caminho ou link)</label>
        <input name="bio_photo" defaultValue={values.bio_photo} className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Título do agendamento</label>
          <input name="bio_booking_title" defaultValue={values.bio_booking_title} className="field" />
        </div>
        <div>
          <label className={label}>Texto do agendamento</label>
          <input name="bio_booking_subtitle" defaultValue={values.bio_booking_subtitle} className="field" />
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-zinc-50/60 p-4">
        {toggles.map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name={k} value="1" defaultChecked={values[k] === "1"} className="peer sr-only" />
            <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-plum peer-checked:after:translate-x-4" />
            <span className="text-sm text-zinc-700">{l}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar perfil
        </button>
        {state?.ok && !pending && <span className="pop text-xs font-semibold text-emerald-600">Guardado</span>}
        {state?.error && <span className="text-xs font-semibold text-rose-600">{state.error}</span>}
      </div>
    </form>
  );
}

/* --------------------------------- LINKS --------------------------------- */

export type BioLinkRow = {
  id: number;
  title: string;
  subtitle: string | null;
  url: string;
  image: string | null;
  highlight: boolean;
  active: boolean;
  clicks: number;
};

function LinkModal({ link, onClose }: { link?: BioLinkRow; onClose: () => void }) {
  const { state, pending, onSubmit } = useBioForm(saveBioLink.bind(null, link?.id ?? null), onClose);
  return (
    <Modal open onClose={onClose} title={link ? "Editar link" : "Novo link"} description="Aparece na página de links do Instagram" icon={Link2}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={label}>Título *</label>
          <input name="title" required defaultValue={link?.title} placeholder="Ex: Guia grátis — 7 erros de marca" className="field" />
        </div>
        <div>
          <label className={label}>Subtítulo</label>
          <input name="subtitle" defaultValue={link?.subtitle ?? ""} placeholder="Uma linha curta que convida ao clique" className="field" />
        </div>
        <div>
          <label className={label}>Link *</label>
          <input name="url" required defaultValue={link?.url} placeholder="https://… ou /mentoria" className="field" />
          <p className="mt-1.5 text-xs text-zinc-500">Página do site (/mentoria), link externo (https://…) ou email (mailto:).</p>
        </div>
        <div>
          <label className={label}>Imagem (opcional)</label>
          <input name="image" defaultValue={link?.image ?? ""} placeholder="/img/… ou https://…" className="field" />
          <p className="mt-1.5 text-xs text-zinc-500">Com imagem, o link aparece como um cartão grande; sem imagem, como um botão.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3">
          <input type="checkbox" name="highlight" value="1" defaultChecked={link?.highlight} className="h-4 w-4 accent-[#800080]" />
          <span className="text-sm text-zinc-700">
            <b className="font-semibold">Destaque</b> — etiqueta e cor da marca, para lançamentos e ofertas
          </span>
        </label>
        {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost !px-5 !py-2.5 !text-xs">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {link ? "Guardar" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function BioLinksManager({ links }: { links: BioLinkRow[] }) {
  const [editing, setEditing] = useState<BioLinkRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      notifySaved();
    });

  return (
    <>
      <ul className="space-y-2">
        {links.map((l, i) => (
          <li
            key={l.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
              l.active ? "border-line bg-white" : "border-dashed border-zinc-200 bg-zinc-50/60 opacity-70"
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl",
                l.highlight ? "bg-plum text-white" : "bg-zinc-100 text-zinc-400"
              )}
            >
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="h-full w-full object-cover" />
              ) : l.highlight ? (
                <Sparkles size={16} />
              ) : (
                <ImageIcon size={16} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-zinc-900">{l.title}</span>
              <span className="block truncate text-xs text-zinc-500">{l.url}</span>
            </span>
            <span className="hidden shrink-0 text-right sm:block">
              <span className="block text-sm font-semibold tabular-nums text-zinc-900">{num(l.clicks)}</span>
              <span className="block text-[10px] uppercase tracking-wider text-zinc-400">cliques</span>
            </span>
            <span className="flex shrink-0 items-center">
              <button type="button" disabled={i === 0 || pending} onClick={() => run(() => moveBioLink(l.id, -1))} className={iconBtn} title="Subir">
                <ArrowUp size={14} />
              </button>
              <button type="button" disabled={i === links.length - 1 || pending} onClick={() => run(() => moveBioLink(l.id, 1))} className={iconBtn} title="Descer">
                <ArrowDown size={14} />
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => toggleBioLink(l.id))} className={iconBtn} title={l.active ? "Esconder" : "Mostrar"}>
                {l.active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button type="button" onClick={() => setEditing(l)} className={iconBtn} title="Editar">
                <Pencil size={14} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm(`Apagar “${l.title}”?`) && run(() => deleteBioLink(l.id))}
                className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
                title="Apagar"
              >
                <Trash2 size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-semibold text-zinc-500 transition-colors hover:border-plum/40 hover:text-plum"
      >
        <Plus size={15} /> Adicionar link
      </button>
      {editing && <LinkModal link={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ---------------------------- PRÉ-VISUALIZAÇÃO ---------------------------- */

/** Telemóvel com a página real; recarrega sozinho depois de cada gravação. */
export function PhonePreview() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => window.setTimeout(() => setVersion((v) => v + 1), 300);
    window.addEventListener("bio-saved", bump);
    return () => window.removeEventListener("bio-saved", bump);
  }, []);
  return (
    <div className="mx-auto w-[300px]">
      <div className="relative rounded-[46px] bg-zinc-900 p-3 shadow-[0_40px_80px_-30px_rgb(24_24_27/0.6)] ring-1 ring-zinc-700">
        <span className="absolute left-1/2 top-5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <iframe key={version} src="/links?preview=1" title="Pré-visualização da página de links" className="h-[600px] w-full rounded-[36px] bg-[#140a14]" />
      </div>
      <button
        type="button"
        onClick={() => setVersion((v) => v + 1)}
        className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-plum"
      >
        <RotateCw size={12} /> Actualizar pré-visualização
      </button>
    </div>
  );
}
