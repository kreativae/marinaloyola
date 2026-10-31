"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronDown,
  Folder,
  FolderPlus,
  Hash,
  Inbox,
  List,
  ListChecks,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  Type,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  createNote,
  createNoteFolder,
  deleteNoteFolder,
  destroyNote,
  emptyNotesTrash,
  linkNoteContact,
  moveNote,
  renameNoteFolder,
  restoreNote,
  saveNote,
  setNotePinned,
  trashNote,
  unlinkNoteContact,
  type NoteDto,
} from "@/lib/actions-notes";
import { quickSearchContacts } from "@/lib/actions-contacts";
import {
  blockId,
  noteTags,
  noteTasks,
  notePreview,
  noteTitle,
  openTaskLines,
  parseNote,
  serializeNote,
  toggleTaskLine,
  TRASH_DAYS,
  type Block,
  type BlockType,
} from "@/lib/notes-def";
import { cn, initials } from "@/lib/utils";

type Folder = { id: number; name: string };
type View =
  | { kind: "all" }
  | { kind: "insights" }
  | { kind: "tasks" }
  | { kind: "contacts" }
  | { kind: "folder"; id: number }
  | { kind: "tag"; tag: string }
  | { kind: "trash" };

const TZ = "Europe/Lisbon";
const DAY = 86400000;
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function shortDate(iso: string) {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(new Date())) return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  if (Date.now() - d.getTime() < 6 * DAY) return d.toLocaleDateString("pt-PT", { weekday: "long", timeZone: TZ });
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TZ });
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** Grupos da lista, como nas Notas: Hoje, Ontem, 7 dias, 30 dias e depois por mês. */
function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(`${dayKey(new Date())}T00:00:00`);
  const that = new Date(`${dayKey(d)}T00:00:00`);
  const diff = Math.round((today.getTime() - that.getTime()) / DAY);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return "Últimos 7 dias";
  if (diff < 30) return "Últimos 30 dias";
  const label = d.toLocaleDateString("pt-PT", { month: "long", year: "numeric", timeZone: TZ });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const isEmpty = (n: NoteDto) => !n.body.trim();

/* ================================ APP ================================== */

export function NotesApp({
  initialNotes,
  initialFolders,
  initialSelected,
  createFor,
}: {
  initialNotes: NoteDto[];
  initialFolders: Folder[];
  initialSelected: number | null;
  createFor: { contactId: number | null; nova: boolean };
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [folders, setFolders] = useState(initialFolders);
  const [view, setView] = useState<View>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<number | null>(initialSelected ?? null);
  const [query, setQuery] = useState("");
  const [mobileEditor, setMobileEditor] = useState(Boolean(initialSelected));
  const [creating, setCreating] = useState(false);

  // Gravação automática: um temporizador por nota, com o corpo mais recente guardado à parte
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const latest = useRef(new Map<number, string>());

  const flush = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t) return;
    clearTimeout(t);
    timers.current.delete(id);
    const body = latest.current.get(id);
    if (body !== undefined) void saveNote(id, body);
  }, []);

  useEffect(() => {
    const all = timers.current;
    const flushAll = () => [...all.keys()].forEach(flush);
    const onHide = () => document.visibilityState === "hidden" && flushAll();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flushAll);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flushAll);
      flushAll();
    };
  }, [flush]);

  const patch = useCallback((id: number, p: Partial<NoteDto>) => {
    setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...p } : n)));
  }, []);

  const updateBody = useCallback(
    (id: number, body: string) => {
      patch(id, { body, updatedAt: new Date().toISOString() });
      latest.current.set(id, body);
      const t = timers.current.get(id);
      if (t) clearTimeout(t);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          void saveNote(id, body);
        }, 600)
      );
    },
    [patch]
  );

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  /** Muda de nota. Como nas Notas da Apple, uma nota deixada vazia desaparece. */
  const select = (id: number | null) => {
    if (selected && selected.id !== id) {
      flush(selected.id);
      if (isEmpty(selected) && !selected.deletedAt) {
        setNotes((all) => all.filter((n) => n.id !== selected.id));
        void destroyNote(selected.id);
      }
    }
    setSelectedId(id);
    setMobileEditor(id !== null);
  };

  const newNote = async (opts: { contactId?: number | null } = {}) => {
    setCreating(true);
    try {
      const n = await createNote({
        folderId: view.kind === "folder" ? view.id : null,
        contactId: opts.contactId ?? null,
        body: view.kind === "tag" ? `# \n#${view.tag}` : "",
      });
      if (selected) select(null);
      setNotes((all) => [n, ...all]);
      if (view.kind !== "folder" && view.kind !== "all" && view.kind !== "tag") setView({ kind: "all" });
      setSelectedId(n.id);
      setMobileEditor(true);
    } finally {
      setCreating(false);
    }
  };

  // "Nova nota" vinda da ficha do contacto ou da paleta ⌘K (?nova=1&contacto=12)
  const created = useRef(false);
  const { nova, contactId: novaContact } = createFor;
  useEffect(() => {
    if (!nova) {
      created.current = false;
      return;
    }
    if (created.current) return;
    created.current = true;
    void createNote({ contactId: novaContact }).then((n) => {
      setNotes((all) => [n, ...all]);
      setSelectedId(n.id);
      setMobileEditor(true);
      router.replace(`/admin/notas?n=${n.id}`, { scroll: false });
    });
  }, [nova, novaContact, router]);

  const live = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const trash = useMemo(() => notes.filter((n) => n.deletedAt), [notes]);
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of live) for (const t of noteTags(n.body)) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [live]);

  const visible = useMemo(() => {
    let list = view.kind === "trash" ? trash : live;
    if (view.kind === "tasks") list = list.filter((n) => noteTasks(n.body).open > 0);
    if (view.kind === "contacts") list = list.filter((n) => n.contacts.length > 0);
    if (view.kind === "folder") list = list.filter((n) => n.folderId === view.id);
    if (view.kind === "tag") list = list.filter((n) => noteTags(n.body).includes(view.tag));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((n) => n.body.toLowerCase().includes(q) || n.contacts.some((c) => c.name.toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      if (view.kind !== "trash" && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [view, live, trash, query]);

  const viewTitle =
    view.kind === "all"
      ? "Todas as notas"
      : view.kind === "tasks"
        ? "Com tarefas por fazer"
        : view.kind === "contacts"
          ? "Ligadas a contactos"
          : view.kind === "folder"
            ? folders.find((f) => f.id === view.id)?.name ?? "Pasta"
            : view.kind === "tag"
              ? `#${view.tag}`
              : view.kind === "trash"
                ? "Apagadas recentemente"
                : "Insights";

  const goView = (v: View) => {
    setView(v);
    setMobileEditor(false);
  };

  const remove = async (n: NoteDto) => {
    const next = visible[visible.findIndex((x) => x.id === n.id) + 1] ?? visible.find((x) => x.id !== n.id) ?? null;
    flush(n.id);
    if (n.deletedAt || isEmpty(n)) {
      if (n.deletedAt && !confirm("Apagar esta nota de vez? Não pode ser recuperada.")) return;
      setNotes((all) => all.filter((x) => x.id !== n.id));
      void destroyNote(n.id);
    } else {
      patch(n.id, { deletedAt: new Date().toISOString(), pinned: false });
      void trashNote(n.id);
    }
    setSelectedId(next?.id ?? null);
    if (!next) setMobileEditor(false);
  };

  return (
    <div className="card flex h-[min(820px,calc(100dvh-210px))] min-h-[560px] overflow-hidden !p-0">
      {/* ----------------------------- pastas ----------------------------- */}
      <Sidebar
        view={view}
        go={goView}
        live={live}
        trashCount={trash.length}
        folders={folders}
        setFolders={setFolders}
        tagCounts={tagCounts}
        onFolderRemoved={(id) => {
          setNotes((all) => all.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
          if (view.kind === "folder" && view.id === id) setView({ kind: "all" });
        }}
      />

      {view.kind === "insights" ? (
        <Insights
          notes={live}
          tagCounts={tagCounts}
          folders={folders}
          open={(id) => {
            setView({ kind: "all" });
            select(id);
          }}
          toggleTask={(n, line) => updateBody(n.id, toggleTaskLine(n.body, line))}
          go={goView}
        />
      ) : (
        <>
          {/* ------------------------------ lista ------------------------------ */}
          <div className={cn("flex w-full min-w-0 flex-col border-r border-line md:w-[280px] md:shrink-0", mobileEditor && "hidden md:flex")}>
            <div className="border-b border-line px-4 pb-3 pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <MobileViewPicker view={view} go={goView} folders={folders} tagCounts={tagCounts} />
                  <p className="hidden truncate font-display text-xl font-semibold text-zinc-950 xl:block">{viewTitle}</p>
                  <p className="text-[11px] text-zinc-500">
                    {visible.length} nota{visible.length === 1 ? "" : "s"}
                  </p>
                </div>
                {view.kind === "trash" ? (
                  trash.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`Apagar de vez ${trash.length} nota(s)?`)) return;
                        setNotes((all) => all.filter((n) => !n.deletedAt));
                        setSelectedId(null);
                        void emptyNotesTrash();
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Esvaziar
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => newNote()}
                    disabled={creating}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-plum transition-colors hover:bg-plum/[0.08]"
                    title="Nova nota"
                    aria-label="Nova nota"
                  >
                    {creating ? <Loader2 size={18} className="animate-spin" /> : <SquarePen size={19} />}
                  </button>
                )}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar"
                  className="h-9 w-full rounded-xl bg-zinc-100 pl-8 pr-8 text-sm outline-none ring-plum/30 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700" aria-label="Limpar pesquisa">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
            {view.kind === "trash" && (
              <p className="border-b border-line bg-zinc-50 px-4 py-2.5 text-[11px] leading-relaxed text-zinc-500">
                As notas ficam aqui {TRASH_DAYS} dias antes de serem apagadas de vez.
              </p>
            )}
            <NoteList notes={visible} selectedId={selectedId} select={select} trash={view.kind === "trash"} folders={folders} query={query} />
          </div>

          {/* ----------------------------- editor ----------------------------- */}
          <div className={cn("min-w-0 flex-1 flex-col", mobileEditor ? "flex" : "hidden md:flex")}>
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                folders={folders}
                onBody={(body) => updateBody(selected.id, body)}
                onBack={() => select(null)}
                onPin={() => {
                  patch(selected.id, { pinned: !selected.pinned });
                  void setNotePinned(selected.id, !selected.pinned);
                }}
                onMove={(folderId) => {
                  patch(selected.id, { folderId });
                  void moveNote(selected.id, folderId);
                }}
                onLink={(c) => patch(selected.id, { contacts: [...selected.contacts.filter((x) => x.id !== c.id), c] })}
                onUnlink={(cid) => {
                  patch(selected.id, { contacts: selected.contacts.filter((x) => x.id !== cid) });
                  void unlinkNoteContact(selected.id, cid);
                }}
                onDelete={() => remove(selected)}
                onRestore={() => {
                  patch(selected.id, { deletedAt: null });
                  void restoreNote(selected.id);
                  setView({ kind: "all" });
                }}
                onTag={(tag) => goView({ kind: "tag", tag })}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <SquarePen size={24} />
                </span>
                <p className="mt-4 font-display text-2xl text-zinc-950">{view.kind === "trash" ? "Nada selecionado" : "Escolha ou crie uma nota"}</p>
                <p className="mt-2 max-w-xs text-sm text-zinc-500">
                  Use <b>- [ ]</b> para tarefas, <b>-</b> para listas, <b>#</b> para títulos e <b>#etiquetas</b> para organizar.
                </p>
                {view.kind !== "trash" && (
                  <button type="button" onClick={() => newNote()} className="btn-primary mt-6 !px-5 !py-2.5 !text-xs">
                    <Plus size={14} /> Nova nota
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== BARRA LATERAL ============================ */

function Sidebar({
  view,
  go,
  live,
  trashCount,
  folders,
  setFolders,
  tagCounts,
  onFolderRemoved,
}: {
  view: View;
  go: (v: View) => void;
  live: NoteDto[];
  trashCount: number;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  tagCounts: [string, number][];
  onFolderRemoved: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const counts = {
    all: live.length,
    tasks: live.filter((n) => noteTasks(n.body).open > 0).length,
    contacts: live.filter((n) => n.contacts.length > 0).length,
  };
  const is = (v: View) => JSON.stringify(v) === JSON.stringify(view);

  const add = () =>
    start(async () => {
      const r = await createNoteFolder(name);
      if (r.ok && r.folder) {
        setFolders((f) => [...f, r.folder!].sort((a, b) => a.name.localeCompare(b.name)));
        setAdding(false);
        setName("");
        go({ kind: "folder", id: r.folder.id });
      }
    });

  return (
    <aside className="admin-scroll hidden w-[220px] shrink-0 flex-col overflow-y-auto border-r border-line bg-zinc-50/70 px-2.5 py-4 xl:flex">
      <SideItem icon={<Sparkles size={15} />} label="Insights" on={is({ kind: "insights" })} onClick={() => go({ kind: "insights" })} accent />
      <div className="my-3 h-px bg-line" />
      <SideItem icon={<Inbox size={15} />} label="Todas as notas" n={counts.all} on={is({ kind: "all" })} onClick={() => go({ kind: "all" })} />
      <SideItem icon={<ListChecks size={15} />} label="Tarefas por fazer" n={counts.tasks} on={is({ kind: "tasks" })} onClick={() => go({ kind: "tasks" })} />
      <SideItem icon={<Users size={15} />} label="Com contactos" n={counts.contacts} on={is({ kind: "contacts" })} onClick={() => go({ kind: "contacts" })} />

      <div className="mb-1 mt-5 flex items-center justify-between px-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Pastas</p>
        <button type="button" onClick={() => setAdding(true)} className="rounded-md p-1 text-zinc-400 hover:bg-white hover:text-plum" title="Nova pasta" aria-label="Nova pasta">
          <FolderPlus size={14} />
        </button>
      </div>
      {folders.map((f) =>
        editing === f.id ? (
          <FolderRename
            key={f.id}
            folder={f}
            done={(newName) => {
              setEditing(null);
              if (newName && newName !== f.name) {
                setFolders((all) => all.map((x) => (x.id === f.id ? { ...x, name: newName } : x)));
                void renameNoteFolder(f.id, newName);
              }
            }}
          />
        ) : (
          <div key={f.id} className="group/folder relative">
            <SideItem
              icon={<Folder size={15} />}
              label={f.name}
              n={live.filter((n) => n.folderId === f.id).length}
              on={is({ kind: "folder", id: f.id })}
              onClick={() => go({ kind: "folder", id: f.id })}
            />
            <span className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-white/90 px-0.5 shadow-sm group-hover/folder:flex">
              <button type="button" onClick={() => setEditing(f.id)} className="rounded-md p-1 text-zinc-400 hover:text-plum" aria-label={`Mudar o nome de ${f.name}`}>
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Apagar a pasta "${f.name}"? As notas passam para "Todas as notas".`)) return;
                  setFolders((all) => all.filter((x) => x.id !== f.id));
                  onFolderRemoved(f.id);
                  void deleteNoteFolder(f.id);
                }}
                className="rounded-md p-1 text-zinc-400 hover:text-rose-600"
                aria-label={`Apagar a pasta ${f.name}`}
              >
                <Trash2 size={12} />
              </button>
            </span>
          </div>
        )
      )}
      {adding ? (
        <div className="mt-1 flex items-center gap-1 px-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => !name.trim() && setAdding(false)}
            placeholder="Nome da pasta"
            className="h-8 min-w-0 flex-1 rounded-lg border border-plum/30 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-plum/20"
          />
          <button type="button" onClick={add} disabled={pending} className="rounded-lg bg-plum p-1.5 text-white" aria-label="Criar pasta">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
        </div>
      ) : (
        folders.length === 0 && (
          <button type="button" onClick={() => setAdding(true)} className="px-2.5 py-1.5 text-left text-xs text-zinc-400 hover:text-plum">
            + Criar a primeira pasta
          </button>
        )
      )}

      {tagCounts.length > 0 && (
        <>
          <p className="mb-2 mt-5 px-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Etiquetas</p>
          <div className="flex flex-wrap gap-1.5 px-2">
            {tagCounts.map(([t]) => (
              <button
                key={t}
                type="button"
                onClick={() => go({ kind: "tag", tag: t })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  is({ kind: "tag", tag: t }) ? "bg-plum text-white" : "bg-white text-zinc-600 ring-1 ring-line hover:text-plum"
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto pt-5">
        <SideItem icon={<Trash2 size={15} />} label="Apagadas recentemente" n={trashCount} on={is({ kind: "trash" })} onClick={() => go({ kind: "trash" })} />
      </div>
    </aside>
  );
}

function SideItem({ icon, label, n, on, onClick, accent }: { icon: React.ReactNode; label: string; n?: number; on: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
        on ? "bg-plum/[0.1] text-plum" : "text-zinc-700 hover:bg-white"
      )}
    >
      <span className={cn("shrink-0", on || accent ? "text-plum" : "text-zinc-400")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {n !== undefined && <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{n}</span>}
    </button>
  );
}

function FolderRename({ folder, done }: { folder: Folder; done: (name: string) => void }) {
  const [v, setV] = useState(folder.name);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") done(v.trim());
        if (e.key === "Escape") done("");
      }}
      onBlur={() => done(v.trim())}
      className="my-0.5 h-8 w-full rounded-lg border border-plum/30 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-plum/20"
    />
  );
}

/** Em ecrãs pequenos a barra lateral dá lugar a este seletor. */
function MobileViewPicker({ view, go, folders, tagCounts }: { view: View; go: (v: View) => void; folders: Folder[]; tagCounts: [string, number][] }) {
  const value =
    view.kind === "folder" ? `folder:${view.id}` : view.kind === "tag" ? `tag:${view.tag}` : view.kind;
  return (
    <div className="relative xl:hidden">
      <select
        value={value}
        onChange={(e) => {
          const [k, rest] = e.target.value.split(":");
          if (k === "folder") go({ kind: "folder", id: Number(rest) });
          else if (k === "tag") go({ kind: "tag", tag: rest });
          else go({ kind: k } as View);
        }}
        className="appearance-none bg-transparent pr-6 font-display text-xl font-semibold text-zinc-950 outline-none"
      >
        <option value="insights">Insights</option>
        <option value="all">Todas as notas</option>
        <option value="tasks">Tarefas por fazer</option>
        <option value="contacts">Com contactos</option>
        {folders.map((f) => (
          <option key={f.id} value={`folder:${f.id}`}>
            {f.name}
          </option>
        ))}
        {tagCounts.map(([t]) => (
          <option key={t} value={`tag:${t}`}>
            #{t}
          </option>
        ))}
        <option value="trash">Apagadas recentemente</option>
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

/* ================================ LISTA ================================== */

function NoteList({
  notes,
  selectedId,
  select,
  trash,
  folders,
  query,
}: {
  notes: NoteDto[];
  selectedId: number | null;
  select: (id: number) => void;
  trash: boolean;
  folders: Folder[];
  query: string;
}) {
  if (notes.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-sm text-zinc-500">
        {query ? "Nenhuma nota encontrada." : trash ? "Nenhuma nota apagada." : "Ainda não há notas aqui."}
      </p>
    );
  }
  const groups = notes.map((n) => (!trash && n.pinned ? "Fixadas" : groupLabel(n.updatedAt)));
  return (
    <ul className="admin-scroll flex-1 overflow-y-auto px-2 py-2">
      {notes.map((n, i) => {
        const header = groups[i] !== groups[i - 1] ? groups[i] : null;
        const tasks = noteTasks(n.body);
        const on = n.id === selectedId;
        const folder = folders.find((f) => f.id === n.folderId);
        return (
          <li key={n.id}>
            {header && (
              <p className="flex items-center gap-1.5 px-3 pb-1.5 pt-3 text-[11px] font-bold text-zinc-500">
                {header === "Fixadas" && <Pin size={11} className="text-amber-500" />}
                {header}
              </p>
            )}
            <button
              type="button"
              onClick={() => select(n.id)}
              className={cn(
                "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                on ? "bg-amber-100/80" : "hover:bg-zinc-50"
              )}
            >
              <span className="block truncate text-sm font-semibold text-zinc-950">{noteTitle(n.body) || "Nova nota"}</span>
              <span className="mt-0.5 flex gap-2 text-xs">
                <span className="shrink-0 font-medium text-zinc-600">{shortDate(n.updatedAt)}</span>
                <span className="truncate text-zinc-500">{notePreview(n.body) || "Sem texto adicional"}</span>
              </span>
              {(tasks.open + tasks.done > 0 || n.contacts.length > 0 || folder) && (
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-500">
                  {folder && (
                    <span className="flex items-center gap-1">
                      <Folder size={11} /> {folder.name}
                    </span>
                  )}
                  {tasks.open + tasks.done > 0 && (
                    <span className={cn("flex items-center gap-1", tasks.open === 0 && "text-emerald-600")}>
                      <CheckSquare size={11} /> {tasks.done}/{tasks.open + tasks.done}
                    </span>
                  )}
                  {n.contacts.slice(0, 2).map((c) => (
                    <span key={c.id} className="flex max-w-[120px] items-center gap-1 truncate text-plum">
                      <UserRound size={11} className="shrink-0" /> <span className="truncate">{c.name}</span>
                    </span>
                  ))}
                  {n.contacts.length > 2 && <span>+{n.contacts.length - 2}</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ================================ EDITOR ================================= */

const FORMATS: { type: BlockType; label: string; hint: string }[] = [
  { type: "title", label: "Título", hint: "⇧⌘T" },
  { type: "heading", label: "Cabeçalho", hint: "⇧⌘H" },
  { type: "text", label: "Corpo", hint: "⇧⌘B" },
  { type: "bullet", label: "• Lista", hint: "⇧⌘7" },
  { type: "check", label: "Lista de tarefas", hint: "⇧⌘L" },
];

function NoteEditor({
  note,
  folders,
  onBody,
  onBack,
  onPin,
  onMove,
  onLink,
  onUnlink,
  onDelete,
  onRestore,
  onTag,
}: {
  note: NoteDto;
  folders: Folder[];
  onBody: (body: string) => void;
  onBack: () => void;
  onPin: () => void;
  onMove: (folderId: number | null) => void;
  onLink: (c: { id: number; name: string }) => void;
  onUnlink: (contactId: number) => void;
  onDelete: () => void;
  onRestore: () => void;
  onTag: (tag: string) => void;
}) {
  const readOnly = Boolean(note.deletedAt);
  const [blocks, setBlocks] = useState<Block[]>(() => parseNote(note.body));
  const [active, setActive] = useState(0);
  const [formatOpen, setFormatOpen] = useState(false);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusNext = useRef<{ id: string; pos: number } | null>(
    note.body.trim() ? null : { id: "", pos: 0 } // nota nova: cursor logo no título
  );

  const commit = (next: Block[], focus?: { id: string; pos: number }) => {
    setBlocks(next);
    onBody(serializeNote(next));
    if (focus) focusNext.current = focus;
  };

  useLayoutEffect(() => {
    // Altura automática de cada linha e cursor no sítio certo depois de Enter/Backspace
    for (const el of refs.current.values()) {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    }
    const f = focusNext.current;
    if (f) {
      focusNext.current = null;
      const el = f.id ? refs.current.get(f.id) : refs.current.values().next().value;
      if (el) {
        el.focus();
        const pos = Math.min(f.pos, el.value.length);
        el.setSelectionRange(pos, pos);
      }
    }
  });

  useEffect(() => {
    const onResize = () => {
      for (const el of refs.current.values()) {
        el.style.height = "0px";
        el.style.height = `${el.scrollHeight}px`;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const setType = (idx: number, type: BlockType) => {
    const b = blocks[idx];
    if (!b) return;
    const nextType = b.type === type && type !== "text" ? "text" : type;
    const el = refs.current.get(b.id);
    commit(
      blocks.map((x, i) => (i === idx ? { ...x, type: nextType, done: nextType === "check" ? Boolean(x.done) : undefined } : x)),
      { id: b.id, pos: el?.selectionStart ?? b.text.length }
    );
  };

  const toggleDone = (idx: number) => {
    if (readOnly) return;
    commit(blocks.map((x, i) => (i === idx ? { ...x, done: !x.done } : x)));
  };

  const onText = (idx: number, value: string) => {
    const b = blocks[idx];
    // Colar várias linhas: cada uma vira um bloco
    if (value.includes("\n")) {
      const [first, ...rest] = value.split("\n");
      const extra = parseNote(rest.join("\n"));
      const next = [...blocks.slice(0, idx), { ...b, text: first }, ...extra, ...blocks.slice(idx + 1)];
      const lastBlock = extra[extra.length - 1];
      commit(next, { id: lastBlock.id, pos: lastBlock.text.length });
      return;
    }
    // Atalhos de escrita no início da linha
    if (b.type === "text" || b.type === "bullet") {
      const shortcut: [RegExp, BlockType, boolean?][] = [
        [/^(- )?\[ ?\] /, "check"],
        [/^(- )?\[x\] /i, "check", true],
        [/^[-*•] /, "bullet"],
        [/^## /, "heading"],
        [/^# /, "title"],
      ];
      for (const [re, type, done] of shortcut) {
        if (re.test(value) && !(b.type === "bullet" && type === "bullet")) {
          const text = value.replace(re, "");
          commit(
            blocks.map((x, i) => (i === idx ? { ...x, type, text, done: type === "check" ? Boolean(done) : undefined } : x)),
            { id: b.id, pos: text.length }
          );
          return;
        }
      }
    }
    commit(blocks.map((x, i) => (i === idx ? { ...x, text: value } : x)));
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const b = blocks[idx];
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.shiftKey) {
      const key = e.key.toLowerCase();
      const map: Record<string, BlockType> = { t: "title", h: "heading", b: "text", l: "check", "7": "bullet", "&": "bullet" };
      if (map[key]) {
        e.preventDefault();
        setType(idx, map[key]);
        return;
      }
      if (key === "u" && b.type === "check") {
        e.preventDefault();
        toggleDone(idx);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const list = b.type === "bullet" || b.type === "check";
      if (list && !b.text) {
        commit(blocks.map((x, i) => (i === idx ? { ...x, type: "text", done: undefined } : x)), { id: b.id, pos: 0 });
        return;
      }
      const nb: Block = { id: blockId(), type: list ? b.type : "text", text: b.text.slice(end), done: list && b.type === "check" ? false : undefined };
      const next = [...blocks];
      next.splice(idx, 1, { ...b, text: b.text.slice(0, start) }, nb);
      commit(next, { id: nb.id, pos: 0 });
      return;
    }

    if (e.key === "Backspace" && start === 0 && end === 0) {
      if (b.type !== "text" && !(idx === 0 && b.type === "title")) {
        e.preventDefault();
        commit(blocks.map((x, i) => (i === idx ? { ...x, type: "text", done: undefined } : x)), { id: b.id, pos: 0 });
        return;
      }
      if (idx > 0) {
        e.preventDefault();
        const prev = blocks[idx - 1];
        const next = blocks.filter((_, i) => i !== idx).map((x) => (x.id === prev.id ? { ...x, text: prev.text + b.text } : x));
        commit(next, { id: prev.id, pos: prev.text.length });
      }
      return;
    }

    if (e.key === "ArrowUp" && start === 0 && end === 0 && idx > 0) {
      e.preventDefault();
      const prev = blocks[idx - 1];
      refs.current.get(prev.id)?.focus();
      refs.current.get(prev.id)?.setSelectionRange(prev.text.length, prev.text.length);
    }
    if (e.key === "ArrowDown" && start === el.value.length && idx < blocks.length - 1) {
      e.preventDefault();
      const nx = blocks[idx + 1];
      refs.current.get(nx.id)?.focus();
      refs.current.get(nx.id)?.setSelectionRange(0, 0);
    }
  };

  const body = serializeNote(blocks);
  const tags = noteTags(body);
  const tasks = noteTasks(body);
  const activeType = blocks[active]?.type ?? "text";

  return (
    <>
      {/* barra de ferramentas */}
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <button type="button" onClick={onBack} className="rounded-lg p-2 text-plum hover:bg-plum/[0.08] md:hidden" aria-label="Voltar à lista">
          <ArrowLeft size={18} />
        </button>
        {readOnly ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <span className="mr-auto px-2 text-xs text-zinc-500">Apagada · recupere-a para editar</span>
            <button type="button" onClick={onRestore} className="btn-ghost !px-4 !py-2 !text-xs">
              <RotateCcw size={13} /> Recuperar
            </button>
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">
              <Trash2 size={13} /> Apagar de vez
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <ToolButton label="Formato do parágrafo" onClick={() => setFormatOpen((v) => !v)} on={formatOpen}>
                <Type size={17} />
              </ToolButton>
              {formatOpen && (
                <div className="pop absolute left-0 top-full z-30 mt-1 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                  {FORMATS.map((f) => (
                    <button
                      key={f.type}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setType(active, f.type);
                        setFormatOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-50",
                        activeType === f.type && "text-plum",
                        f.type === "title" && "font-display text-lg font-bold",
                        f.type === "heading" && "font-semibold",
                        f.type !== "title" && "text-sm"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {activeType === f.type ? <Check size={13} /> : <span className="w-[13px]" />}
                        {f.label}
                      </span>
                      <span className="font-sans text-[10px] font-normal text-zinc-400">{f.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ToolButton label="Lista de tarefas (⇧⌘L)" onClick={() => setType(active, "check")} on={activeType === "check"}>
              <ListChecks size={17} />
            </ToolButton>
            <ToolButton label="Lista (⇧⌘7)" onClick={() => setType(active, "bullet")} on={activeType === "bullet"}>
              <List size={17} />
            </ToolButton>
            <div className="mx-1 h-5 w-px bg-line" />
            <ContactPicker noteId={note.id} onLink={onLink} />
            <div className="ml-auto flex items-center gap-1">
              <FolderSelect folders={folders} value={note.folderId} onChange={onMove} />
              <ToolButton label={note.pinned ? "Desafixar" : "Fixar no topo"} onClick={onPin} on={note.pinned}>
                {note.pinned ? <PinOff size={17} /> : <Pin size={17} />}
              </ToolButton>
              <ToolButton label="Apagar nota" onClick={onDelete} danger>
                <Trash2 size={17} />
              </ToolButton>
            </div>
          </>
        )}
      </div>

      {/* conteúdo */}
      <div className="admin-scroll flex-1 overflow-y-auto" onClick={() => setFormatOpen(false)}>
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-5 sm:px-10">
          <p className="mb-4 text-center text-[11px] text-zinc-400">
            {longDate(note.updatedAt)}
            {note.author && <> · {note.author}</>}
          </p>

          {note.contacts.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {note.contacts.map((c) => (
                <span key={c.id} className="group/chip inline-flex items-center gap-1.5 rounded-full bg-plum/[0.07] py-1 pl-1 pr-2 text-xs font-semibold text-plum">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-plum text-[9px] text-white">{initials(c.name)}</span>
                  <Link href={`/admin/crm/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                  {!readOnly && (
                    <button type="button" onClick={() => onUnlink(c.id)} className="rounded-full p-0.5 text-plum/50 hover:bg-plum/10 hover:text-plum" aria-label={`Desligar ${c.name}`}>
                      <X size={11} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div>
            {blocks.map((b, idx) => (
              <div key={b.id} className={cn("flex items-start gap-2.5", b.type === "title" ? "mb-2" : b.type === "heading" ? "mb-1 mt-3" : "")}>
                {b.type === "check" && (
                  <button
                    type="button"
                    onClick={() => toggleDone(idx)}
                    className={cn(
                      "mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
                      b.done ? "border-amber-500 bg-amber-500 text-white" : "border-zinc-300 hover:border-amber-500"
                    )}
                    aria-label={b.done ? "Marcar por fazer" : "Marcar como feita"}
                  >
                    {b.done && <Check size={11} strokeWidth={3} />}
                  </button>
                )}
                {b.type === "bullet" && <span className="mt-[1px] w-[18px] shrink-0 text-center text-[15px] leading-6 text-zinc-500">•</span>}
                <textarea
                  ref={(el) => {
                    if (el) refs.current.set(b.id, el);
                    else refs.current.delete(b.id);
                  }}
                  rows={1}
                  value={b.text}
                  readOnly={readOnly}
                  placeholder={idx === 0 && blocks.length === 1 ? "Título" : idx === 1 && blocks.length === 2 && !b.text ? "Escreva aqui…" : undefined}
                  onChange={(e) => onText(idx, e.target.value)}
                  onKeyDown={(e) => onKeyDown(idx, e)}
                  onFocus={() => setActive(idx)}
                  className={cn(
                    "block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-zinc-300",
                    b.type === "title" && "font-display text-[1.75rem] font-bold leading-tight text-zinc-950",
                    b.type === "heading" && "text-lg font-semibold leading-snug text-zinc-900",
                    (b.type === "text" || b.type === "bullet" || b.type === "check") && "text-[15px] leading-6",
                    b.type === "check" && b.done ? "text-zinc-400 line-through decoration-zinc-300" : b.type !== "title" && b.type !== "heading" && "text-zinc-800"
                  )}
                />
              </div>
            ))}
          </div>

          {(tags.length > 0 || tasks.open + tasks.done > 0) && (
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {tasks.open + tasks.done > 0 && (
                <span className="mr-2 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                    <span className="block h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(tasks.done / (tasks.open + tasks.done)) * 100}%` }} />
                  </span>
                  {tasks.done} de {tasks.open + tasks.done} feitas
                </span>
              )}
              {tags.map((t) => (
                <button key={t} type="button" onClick={() => onTag(t)} className="flex items-center gap-0.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-plum/10 hover:text-plum">
                  <Hash size={11} />
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ToolButton({ label, onClick, on, danger, children }: { label: string; onClick: () => void; on?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // mantém o cursor na linha atual
      onClick={onClick}
      className={cn(
        "rounded-lg p-2 transition-colors",
        on ? "bg-amber-100 text-amber-700" : danger ? "text-zinc-500 hover:bg-rose-50 hover:text-rose-600" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      {children}
    </button>
  );
}

function FolderSelect({ folders, value, onChange }: { folders: Folder[]; value: number | null; onChange: (id: number | null) => void }) {
  if (folders.length === 0) return null;
  return (
    <label className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100" title="Mover para pasta">
      <Folder size={15} />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="max-w-[110px] cursor-pointer appearance-none truncate bg-transparent pr-1 outline-none"
      >
        <option value="">Sem pasta</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Procura um contacto do CRM e liga-o à nota. */
function ContactPicker({ noteId, onLink }: { noteId: number; onLink: (c: { id: number; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; email: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      setLoading(true);
      quickSearchContacts(q)
        .then((r) => setResults(r.map(({ id, name, email }) => ({ id, name, email }))))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (id: number) => {
    const r = await linkNoteContact(noteId, id);
    if (r.ok && r.contact) onLink(r.contact);
    setOpen(false);
    setQ("");
    setResults([]);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors", open ? "bg-plum/10 text-plum" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900")}
        title="Ligar a um contacto"
      >
        <UserRound size={16} /> <span className="hidden sm:inline">Contacto</span>
      </button>
      {open && (
        <div className="pop absolute left-0 top-full z-30 mt-1 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) void pick(results[0].id);
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Pesquisar contacto…"
              className="h-9 w-full rounded-xl bg-zinc-100 pl-8 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-plum/20"
            />
          </div>
          <ul className="mt-1.5 max-h-60 overflow-y-auto">
            {loading && (
              <li className="flex justify-center py-3">
                <Loader2 size={15} className="animate-spin text-plum" />
              </li>
            )}
            {!loading && q.trim().length >= 2 && results.length === 0 && <li className="px-3 py-3 text-xs text-zinc-500">Nenhum contacto encontrado.</li>}
            {!loading && q.trim().length < 2 && <li className="px-3 py-3 text-xs text-zinc-500">Escreva pelo menos 2 letras do nome, email ou telefone.</li>}
            {!loading &&
              q.trim().length >= 2 &&
              results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r.id)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-zinc-50">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600">{initials(r.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{r.name}</span>
                      {r.email && <span className="block truncate text-[11px] text-zinc-500">{r.email}</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* =============================== INSIGHTS ================================ */

function Insights({
  notes,
  tagCounts,
  folders,
  open,
  toggleTask,
  go,
}: {
  notes: NoteDto[];
  tagCounts: [string, number][];
  folders: Folder[];
  open: (id: number) => void;
  toggleTask: (n: NoteDto, line: number) => void;
  go: (v: View) => void;
}) {
  const [now] = useState(() => Date.now());
  let openTasks = 0;
  let doneTasks = 0;
  for (const n of notes) {
    const t = noteTasks(n.body);
    openTasks += t.open;
    doneTasks += t.done;
  }
  const totalTasks = openTasks + doneTasks;
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const week = notes.filter((n) => now - new Date(n.createdAt).getTime() < 7 * DAY).length;
  const editedWeek = notes.filter((n) => now - new Date(n.updatedAt).getTime() < 7 * DAY).length;

  const taskList = notes
    .flatMap((n) => openTaskLines(n.body).map((t) => ({ note: n, ...t })))
    .sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt))
    .slice(0, 12);

  const byContact = new Map<number, { id: number; name: string; n: number; last: string }>();
  for (const n of notes)
    for (const c of n.contacts) {
      const cur = byContact.get(c.id);
      byContact.set(c.id, { id: c.id, name: c.name, n: (cur?.n ?? 0) + 1, last: cur && cur.last > n.updatedAt ? cur.last : n.updatedAt });
    }
  const topContacts = [...byContact.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 6);

  const stale = notes
    .filter((n) => noteTasks(n.body).open > 0 && now - new Date(n.updatedAt).getTime() > 14 * DAY)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, 5);

  // Notas criadas em cada uma das últimas 12 semanas
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const endAt = now - (11 - i) * 7 * DAY;
    const startAt = endAt - 7 * DAY;
    return {
      label: new Date(startAt + DAY).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", timeZone: TZ }),
      n: notes.filter((n) => {
        const t = new Date(n.createdAt).getTime();
        return t > startAt && t <= endAt;
      }).length,
    };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n));
  const maxTag = Math.max(1, ...tagCounts.map(([, n]) => n));
  const folderCounts = folders.map((f) => ({ ...f, n: notes.filter((n) => n.folderId === f.id).length })).filter((f) => f.n > 0);

  return (
    <div className="admin-scroll min-w-0 flex-1 overflow-y-auto bg-zinc-50/40 p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="xl:hidden">
            <MobileViewPicker view={{ kind: "insights" }} go={go} folders={folders} tagCounts={tagCounts} />
          </div>
          <p className="hidden items-center gap-2 font-display text-2xl font-semibold text-zinc-950 xl:flex">
            <Sparkles size={20} className="text-plum" /> Insights das notas
          </p>
          <p className="mt-1 text-sm text-zinc-500">O que está por fazer, o que anda esquecido e de quem mais se fala.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Notas" value={notes.length} hint={`${editedWeek} editadas esta semana`} />
        <Tile label="Novas · 7 dias" value={week} hint={week ? "Bom ritmo" : "Nenhuma esta semana"} />
        <Tile label="Tarefas por fazer" value={openTasks} hint={`${doneTasks} concluídas`} onClick={() => go({ kind: "tasks" })} />
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zinc-400">Concluídas</p>
          <div className="mt-2 flex items-center gap-3">
            <Ring pct={pct} />
            <p className="text-xs leading-snug text-zinc-500">
              {totalTasks ? (
                <>
                  <b className="text-zinc-900">{doneTasks}</b> de {totalTasks} tarefas
                </>
              ) : (
                "Ainda sem tarefas"
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Tarefas por fazer" action={openTasks > taskList.length ? <button type="button" onClick={() => go({ kind: "tasks" })} className="text-xs font-semibold text-plum">Ver todas</button> : null}>
          {taskList.length === 0 ? (
            <Empty text="Tudo feito. Crie tarefas numa nota com - [ ] ou o botão de lista de tarefas." />
          ) : (
            <ul className="space-y-1">
              {taskList.map((t) => (
                <li key={`${t.note.id}-${t.line}`} className="group flex items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-zinc-50">
                  <button
                    type="button"
                    onClick={() => toggleTask(t.note, t.line)}
                    className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-zinc-300 text-white transition-colors hover:border-amber-500 hover:bg-amber-500"
                    aria-label="Marcar como feita"
                  >
                    <Check size={11} strokeWidth={3} className="opacity-0 group-hover:opacity-100" />
                  </button>
                  <button type="button" onClick={() => open(t.note.id)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm text-zinc-800">{t.text}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {noteTitle(t.note.body) || "Nova nota"}
                      {t.note.contacts[0] && <span className="text-plum"> · {t.note.contacts[0].name}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Notas criadas · últimas 12 semanas">
          <div className="flex h-36 items-end gap-1.5">
            {weeks.map((w, i) => (
              <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[10px] tabular-nums text-zinc-400 opacity-0 group-hover:opacity-100">{w.n}</span>
                <span
                  className={cn("w-full rounded-md transition-all", i === weeks.length - 1 ? "bg-plum" : "bg-plum/25 group-hover:bg-plum/50")}
                  style={{ height: `${Math.max(4, (w.n / maxWeek) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
            <span>{weeks[0].label}</span>
            <span>esta semana</span>
          </div>
        </Card>

        <Card title="De quem mais se fala">
          {topContacts.length === 0 ? (
            <Empty text="Ligue notas a contactos com o botão Contacto no editor." />
          ) : (
            <ul className="space-y-1">
              {topContacts.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/crm/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum/10 text-[11px] font-bold text-plum">{initials(c.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{c.name}</span>
                      <span className="block text-[11px] text-zinc-500">última nota {shortDate(c.last)}</span>
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">{c.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Etiquetas mais usadas">
          {tagCounts.length === 0 ? (
            <Empty text="Escreva #etiqueta numa nota (ex: #ideias, #mentoria) para as agrupar." />
          ) : (
            <ul className="space-y-2">
              {tagCounts.slice(0, 8).map(([t, n]) => (
                <li key={t}>
                  <button type="button" onClick={() => go({ kind: "tag", tag: t })} className="flex w-full items-center gap-3 text-left">
                    <span className="w-28 shrink-0 truncate text-sm font-medium text-zinc-700">#{t}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / maxTag) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right text-xs tabular-nums text-zinc-500">{n}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Esquecidas · tarefas paradas há mais de 14 dias">
          {stale.length === 0 ? (
            <Empty text="Nenhuma nota com tarefas esquecidas." />
          ) : (
            <ul className="space-y-1">
              {stale.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-50">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{noteTitle(n.body) || "Nova nota"}</span>
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {noteTasks(n.body).open} por fazer · {Math.floor((now - new Date(n.updatedAt).getTime()) / DAY)} dias
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {folderCounts.length > 0 && (
          <Card title="Pastas">
            <div className="flex flex-wrap gap-2">
              {folderCounts.map((f) => (
                <button key={f.id} type="button" onClick={() => go({ kind: "folder", id: f.id })} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:border-plum/30">
                  <Folder size={14} className="text-amber-500" /> {f.name} <span className="tabular-nums text-zinc-400">{f.n}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, hint, onClick }: { label: string; value: number; hint: string; onClick?: () => void }) {
  const inner = (
    <>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums leading-none text-zinc-950">{value}</p>
      <p className="mt-1.5 text-[11px] text-zinc-500">{hint}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-plum/30">
      {inner}
    </button>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-4">{inner}</div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#f4f4f5" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} className="transition-all duration-700" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" transform="rotate(90 22 22)" className="fill-zinc-900 text-[10px] font-bold">
        {pct}%
      </text>
    </svg>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="py-6 text-center text-sm text-zinc-500">{text}</p>;

/* ============================ FICHA DO CONTACTO =========================== */

/** Botão "Nova nota" na ficha do contacto: cria a nota já ligada e abre-a. */
export function NewContactNoteButton({ contactId }: { contactId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const n = await createNote({ contactId });
          router.push(`/admin/notas?n=${n.id}`);
        })
      }
      className="btn-primary !px-4 !py-2 !text-xs"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Nova nota
    </button>
  );
}
