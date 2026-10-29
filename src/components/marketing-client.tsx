"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { KanbanBoard } from "@/components/admin-client";
import { Modal } from "@/components/contacts-client";
import { movePost, deletePost } from "@/lib/actions-admin";
import { duplicatePost, reschedulePost, savePostAction, type PostResult } from "@/lib/actions-marketing";
import { FORMATS, LIMITS, NETWORK_COLORS, STATUS_COLORS } from "@/lib/marketing-def";
import { cn, num, POST_STATUS } from "@/lib/utils";

const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";

export type PostData = {
  id: number;
  title: string;
  network: string;
  format: string;
  status: string;
  /** "AAAA-MM-DDTHH:MM" na hora de Lisboa */
  publishLocal: string | null;
  /** "12 nov, 10:00" */
  publishLabel: string | null;
  copy: string | null;
  hashtags: string | null;
  link: string | null;
  notes: string | null;
};

export function NetworkDot({ network, className }: { network: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: NETWORK_COLORS[network] ?? "#800080" }} />;
}

/* ------------------------------- EDITOR ---------------------------------- */

export function PostModal({ post, defaults, onClose }: { post?: PostData; defaults?: Partial<PostData>; onClose: () => void }) {
  const router = useRouter();
  const [network, setNetwork] = useState(post?.network ?? defaults?.network ?? "Instagram");
  const [copy, setCopy] = useState(post?.copy ?? "");
  const [state, run, pending] = useActionState(async (prev: PostResult | null, fd: FormData) => {
    const r = await savePostAction(post?.id ?? null, prev, fd);
    if (r.ok) {
      onClose();
      router.refresh();
    }
    return r;
  }, null);
  const [busy, start] = useTransition();
  const limit = LIMITS[network];

  return (
    <Modal open onClose={onClose} title={post ? "Editar conteúdo" : "Novo conteúdo"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => run(fd));
        }}
        className="space-y-4"
      >
        <div>
          <label className={label}>Tema / título *</label>
          <input name="title" required defaultValue={post?.title} placeholder="Ex: 5 erros que barateiam uma marca" className="field" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Rede</label>
            <select name="network" value={network} onChange={(e) => setNetwork(e.target.value)} className="field">
              {Object.keys(NETWORK_COLORS).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Formato</label>
            <select name="format" defaultValue={post?.format ?? "Carrossel"} className="field">
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Estado</label>
            <select name="status" defaultValue={post?.status ?? defaults?.status ?? "idea"} className="field">
              {Object.entries(POST_STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Publicação (hora de Lisboa)</label>
          <input name="publishAt" type="datetime-local" defaultValue={post?.publishLocal ?? defaults?.publishLocal ?? ""} className="field" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className={label}>Legenda / texto</label>
            <span className={cn("text-[11px] tabular-nums", limit && copy.length > limit ? "font-semibold text-rose-600" : "text-zinc-400")}>
              {copy.length}
              {limit ? ` / ${num(limit)}` : ""}
            </span>
          </div>
          <textarea
            name="copy"
            rows={5}
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            placeholder="Gancho, desenvolvimento, chamada para acção…"
            className="field resize-y leading-relaxed"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Hashtags</label>
            <input name="hashtags" defaultValue={post?.hashtags ?? ""} placeholder="#branding #designer" className="field" />
          </div>
          <div>
            <label className={label}>Link</label>
            <input name="link" defaultValue={post?.link ?? ""} placeholder="Ficheiro, Canva, publicação…" className="field" />
          </div>
        </div>
        <div>
          <label className={label}>Notas internas</label>
          <textarea name="notes" rows={2} defaultValue={post?.notes ?? ""} className="field resize-y" />
        </div>
        {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div className="flex gap-1">
            {post && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      await duplicatePost(post.id);
                      onClose();
                      router.refresh();
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Copy size={13} /> Duplicar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    confirm(`Apagar “${post.title}”?`) &&
                    start(async () => {
                      await deletePost(post.id);
                      onClose();
                      router.refresh();
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={13} /> Apagar
                </button>
                {post.link && /^https?:/.test(post.link) && (
                  <a href={post.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100">
                    <ExternalLink size={13} /> Abrir link
                  </a>
                )}
              </>
            )}
          </div>
          <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {post ? "Guardar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewPostButton({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 !text-xs">
        <Plus size={14} /> Novo conteúdo
      </button>
      {open && <PostModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* -------------------------------- QUADRO --------------------------------- */

export function ContentBoard({ posts }: { posts: PostData[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = posts.find((p) => p.id === openId);
  return (
    <>
      <KanbanBoard
        columns={Object.entries(POST_STATUS).map(([id, name]) => ({ id, name, color: STATUS_COLORS[id] }))}
        cards={posts.map((p) => ({
          id: p.id,
          columnId: p.status,
          title: p.title,
          subtitle: p.copy ? p.copy.slice(0, 90) + (p.copy.length > 90 ? "…" : "") : undefined,
          accent: NETWORK_COLORS[p.network],
          chips: [p.network, p.format],
          footer: p.publishLabel ? `Publica ${p.publishLabel}` : "Sem data de publicação",
        }))}
        onMove={async (id, col) => {
          await movePost(id, col);
        }}
        onOpen={setOpenId}
      />
      {open && <PostModal key={open.id} post={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* ------------------------------ CALENDÁRIO -------------------------------- */

export function ContentCalendar({
  month,
  today,
  posts,
}: {
  month: string; // AAAA-MM
  today: string; // AAAA-MM-DD (Lisboa)
  posts: (PostData & { day: string | null; time: string | null })[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [newDay, setNewDay] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  // Ref além do estado: o dragover pode chegar antes de o estado actualizar
  const dragRef = useRef<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<number, string>>({});
  const [, start] = useTransition();
  const [seen, setSeen] = useState(posts);
  if (seen !== posts) {
    setSeen(posts);
    setMoved({});
  }

  const [y, m] = month.split("-").map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((offset + new Date(y, m, 0).getDate()) / 7);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(y, m - 1, 1 - offset + i));
  const dayOf = (p: (typeof posts)[number]) => moved[p.id] ?? p.day;
  const open = posts.find((p) => p.id === openId);

  return (
    <>
      <div className="admin-scroll overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-zinc-200/60">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div key={d} className="bg-zinc-50 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const key = iso(d);
            const inMonth = d.getMonth() === m - 1;
            const list = posts.filter((p) => dayOf(p) === key);
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  if (dragRef.current === null) return;
                  e.preventDefault();
                  setOver(key);
                }}
                onDragLeave={() => setOver((o) => (o === key ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragRef.current;
                  dragRef.current = null;
                  setDrag(null);
                  setOver(null);
                  if (id === null) return;
                  setMoved((mv) => ({ ...mv, [id]: key }));
                  start(async () => {
                    await reschedulePost(id, key);
                    router.refresh();
                  });
                }}
                onDoubleClick={() => setNewDay(key)}
                className={cn(
                  "group/day min-h-[118px] p-1.5 transition-colors",
                  over === key ? "bg-plum/[0.07]" : inMonth ? "bg-white" : "bg-zinc-50/80"
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                      key === today ? "bg-plum text-white" : inMonth ? "text-zinc-700" : "text-zinc-300"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewDay(key)}
                    className="rounded-md p-0.5 text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-plum group-hover/day:opacity-100"
                    aria-label="Novo conteúdo neste dia"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <div className="space-y-1">
                  {list.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      draggable
                      onDragStart={() => {
                        dragRef.current = p.id;
                        setDrag(p.id);
                      }}
                      onDragEnd={() => {
                        dragRef.current = null;
                        setDrag(null);
                        setOver(null);
                      }}
                      onClick={() => setOpenId(p.id)}
                      className={cn(
                        "flex w-full cursor-grab items-center gap-1.5 truncate rounded-lg border-l-[3px] bg-zinc-50 px-1.5 py-1 text-left text-[10.5px] font-medium text-zinc-700 transition-all hover:bg-plum/[0.06] active:cursor-grabbing",
                        p.status === "published" && "opacity-60",
                        drag === p.id && "opacity-40"
                      )}
                      style={{ borderLeftColor: NETWORK_COLORS[p.network] ?? "#800080" }}
                      title={`${p.time ?? ""} ${p.title} · ${p.network} · ${POST_STATUS[p.status]}`}
                    >
                      <span className="shrink-0 tabular-nums text-zinc-400">{p.time}</span>
                      <span className="truncate">{p.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">Arraste um conteúdo para outro dia · clique duas vezes num dia para criar.</p>
      {open && <PostModal key={open.id} post={open} onClose={() => setOpenId(null)} />}
      {newDay && <PostModal defaults={{ publishLocal: `${newDay}T10:00`, status: "idea" }} onClose={() => setNewDay(null)} />}
    </>
  );
}

/* --------------------------------- LISTA --------------------------------- */

export function ContentList({ posts }: { posts: PostData[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = posts.find((p) => p.id === openId);
  return (
    <>
      <div className="table-shell">
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <th className="admin-th">Conteúdo</th>
              <th className="admin-th hidden md:table-cell">Rede · formato</th>
              <th className="admin-th hidden sm:table-cell">Publicação</th>
              <th className="admin-th">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {posts.map((p) => (
              <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer hover:bg-zinc-50/60">
                <td className="admin-td">
                  <span className="block font-semibold text-zinc-950">{p.title}</span>
                  {p.copy && <span className="block max-w-md truncate text-xs text-zinc-500">{p.copy}</span>}
                </td>
                <td className="admin-td hidden whitespace-nowrap text-xs text-zinc-600 md:table-cell">
                  <span className="flex items-center gap-1.5">
                    <NetworkDot network={p.network} /> {p.network} · {p.format}
                  </span>
                </td>
                <td className="admin-td hidden whitespace-nowrap text-xs text-zinc-500 sm:table-cell">{p.publishLabel ?? "—"}</td>
                <td className="admin-td">
                  <span
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: `${STATUS_COLORS[p.status]}1a`, color: STATUS_COLORS[p.status] === "#a1a1aa" ? "#52525b" : STATUS_COLORS[p.status] }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[p.status] }} />
                    {POST_STATUS[p.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <PostModal key={open.id} post={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
