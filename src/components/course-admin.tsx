"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Paperclip,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteCourseFile,
  deleteLesson,
  deleteModule,
  moveCourseFile,
  moveLesson,
  moveModule,
  renameCourseFile,
  renameModule,
  updateCourse,
  updateLesson,
  uploadCourseFiles,
  type CourseFormResult,
} from "@/lib/actions-courses";
import { Modal } from "@/components/contacts-client";
import { cn } from "@/lib/utils";

const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";
const iconBtn =
  "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-plum disabled:pointer-events-none disabled:opacity-30";

/** Formulário com submissão manual (não limpa os campos num erro) que fecha ao guardar. */
function useSaveForm(
  action: (prev: CourseFormResult | null, fd: FormData) => Promise<CourseFormResult>,
  onSaved: () => void
) {
  const [state, run, pending] = useActionState(async (prev: CourseFormResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) onSaved();
    return r;
  }, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
  return { state, pending, onSubmit };
}

function SaveRow({ pending, error, onCancel }: { pending: boolean; error?: string; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
      <button type="submit" disabled={pending} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-60">
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar alterações
      </button>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
        Cancelar
      </button>
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

/* -------------------------------- CURSO --------------------------------- */

export type CourseData = {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  level: string;
  price: string;
  cover: string | null;
  hotmartUrl: string | null;
};

export function CourseEditButton({ course }: { course: CourseData }) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useSaveForm(updateCourse.bind(null, course.id), () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost !px-5 !py-2.5 !text-xs">
        <Pencil size={14} /> Editar curso
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar curso">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Título</label>
            <input name="title" defaultValue={course.title} required className="field" />
          </div>
          <div>
            <label className={labelCls}>Subtítulo</label>
            <input name="subtitle" defaultValue={course.subtitle ?? ""} className="field" />
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <textarea name="description" rows={4} defaultValue={course.description ?? ""} className="field resize-y" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nível</label>
              <input name="level" defaultValue={course.level} className="field" />
            </div>
            <div>
              <label className={labelCls}>Preço (€)</label>
              <input name="price" inputMode="decimal" defaultValue={course.price} className="field" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Endereço (slug)</label>
            <input name="slug" defaultValue={course.slug} className="field font-mono !text-xs" />
          </div>
          <div>
            <label className={labelCls}>Imagem de capa (URL)</label>
            <input name="cover" defaultValue={course.cover ?? ""} placeholder="/img/… ou https://…" className="field" />
          </div>
          <div>
            <label className={labelCls}>Link de compra Hotmart</label>
            <input name="hotmartUrl" defaultValue={course.hotmartUrl ?? ""} placeholder="https://pay.hotmart.com/…" className="field" />
          </div>
          <SaveRow pending={pending} error={state?.error} onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------- MÓDULOS -------------------------------- */

export function ModuleActions({
  id,
  title,
  first,
  last,
  lessonCount,
}: {
  id: number;
  title: string;
  first: boolean;
  last: boolean;
  lessonCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.current?.value ?? "";
          start(async () => {
            await renameModule(id, v);
            setEditing(false);
          });
        }}
        className="flex flex-1 items-center gap-2 pl-4"
      >
        <input ref={input} defaultValue={title} autoFocus className="field !py-1.5 !text-sm" />
        <button type="submit" disabled={pending} className={iconBtn} aria-label="Guardar">
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={iconBtn} aria-label="Cancelar">
          <X size={15} />
        </button>
      </form>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" onClick={() => setEditing(true)} className={iconBtn} title="Renomear módulo">
        <Pencil size={14} />
      </button>
      <button type="button" disabled={first || pending} onClick={() => start(() => moveModule(id, -1))} className={iconBtn} title="Subir">
        <ArrowUp size={14} />
      </button>
      <button type="button" disabled={last || pending} onClick={() => start(() => moveModule(id, 1))} className={iconBtn} title="Descer">
        <ArrowDown size={14} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const msg = lessonCount
            ? `Apagar o módulo “${title}” e as suas ${lessonCount} aula(s)? O progresso das alunas nestas aulas e os anexos também são apagados.`
            : `Apagar o módulo “${title}”?`;
          if (confirm(msg)) start(() => deleteModule(id));
        }}
        className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
        title="Apagar módulo"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* -------------------------------- AULAS --------------------------------- */

export type LessonData = {
  id: number;
  moduleId: number;
  title: string;
  type: "video" | "material" | "quiz";
  durationMin: number;
  videoUrl: string | null;
  materialUrl: string | null;
  content: string | null;
};

export function LessonActions({
  lesson,
  courseId,
  modules,
  first,
  last,
}: {
  lesson: LessonData;
  courseId: number;
  modules: { id: number; title: string }[];
  first: boolean;
  last: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(lesson.type);
  const [pending, start] = useTransition();
  const { state, pending: saving, onSubmit } = useSaveForm(updateLesson.bind(null, lesson.id), () => setOpen(false));

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => setOpen(true)} className={iconBtn} title="Editar aula">
          <Pencil size={14} />
        </button>
        <button type="button" disabled={first || pending} onClick={() => start(() => moveLesson(lesson.id, -1))} className={iconBtn} title="Subir">
          <ArrowUp size={14} />
        </button>
        <button type="button" disabled={last || pending} onClick={() => start(() => moveLesson(lesson.id, 1))} className={iconBtn} title="Descer">
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            confirm(`Apagar a aula “${lesson.title}”? O progresso das alunas nesta aula e os anexos da aula também são apagados.`) &&
            start(() => deleteLesson(lesson.id))
          }
          className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
          title="Apagar aula"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar aula">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Título</label>
            <input name="title" defaultValue={lesson.title} required className="field" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select name="type" value={type} onChange={(e) => setType(e.target.value as LessonData["type"])} className="field">
                <option value="video">Vídeo</option>
                <option value="material">Material</option>
                <option value="quiz">Quiz</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Duração (min)</label>
              <input name="durationMin" type="number" min={1} defaultValue={lesson.durationMin} className="field" />
            </div>
            <div>
              <label className={labelCls}>Módulo</label>
              <select name="moduleId" defaultValue={lesson.moduleId} className="field">
                {modules.map((m, i) => (
                  <option key={m.id} value={m.id}>
                    {i + 1}. {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {type === "video" && (
            <div>
              <label className={labelCls}>Link do vídeo</label>
              <input name="videoUrl" defaultValue={lesson.videoUrl ?? ""} required placeholder="YouTube, Vimeo ou ficheiro .mp4" className="field" />
              <p className="mt-1.5 text-xs text-zinc-500">Aceita links do YouTube e Vimeo (incluindo não listados) ou um .mp4 directo.</p>
            </div>
          )}
          {type === "material" && (
            <div>
              <label className={labelCls}>Link do material (opcional)</label>
              <input name="materialUrl" defaultValue={lesson.materialUrl ?? ""} placeholder="https://… — ou anexe ficheiros abaixo na página" className="field" />
            </div>
          )}
          {type === "quiz" && (
            <p className="rounded-xl bg-plum/[0.06] px-4 py-3 text-xs text-zinc-700">
              As questões editam-se no{" "}
              <Link href={`/admin/cursos/${courseId}/quiz/${lesson.id}`} className="font-semibold text-plum hover:underline">
                banco de questões
              </Link>
              .
            </p>
          )}
          {/* Mantém os valores dos outros tipos ao trocar de tipo */}
          {type !== "video" && <input type="hidden" name="videoUrl" value={lesson.videoUrl ?? ""} />}
          {type !== "material" && <input type="hidden" name="materialUrl" value={lesson.materialUrl ?? ""} />}
          <div>
            <label className={labelCls}>{type === "quiz" ? "Instruções" : "Texto da aula"}</label>
            <textarea name="content" rows={type === "material" ? 8 : 4} defaultValue={lesson.content ?? ""} className="field resize-y" />
            <p className="mt-1.5 text-xs text-zinc-500">Separe parágrafos com uma linha vazia.</p>
          </div>
          <SaveRow pending={saving} error={state?.error} onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------ FICHEIROS ------------------------------- */

export type FileData = {
  id: number;
  name: string;
  size: string;
  mime: string;
  lessonId: number | null;
  downloads: number;
  createdAt: string;
};

export function UploadFiles({ courseId, lessons }: { courseId: number; lessons: { id: number; title: string }[] }) {
  const [state, run, pending] = useActionState(uploadCourseFiles.bind(null, courseId), null);
  const [names, setNames] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      key={state?.savedAt ?? "upload"}
      action={run}
      className="space-y-3"
    >
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (inputRef.current && e.dataTransfer.files.length) {
            inputRef.current.files = e.dataTransfer.files;
            setNames([...e.dataTransfer.files].map((f) => f.name));
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          drag ? "border-plum bg-plum/[0.05]" : "border-zinc-200 hover:border-plum/40"
        )}
      >
        <Upload size={20} className="text-plum" />
        <span className="text-sm font-semibold text-zinc-800">
          {names.length ? names.join(", ") : "Arraste ficheiros ou clique para escolher"}
        </span>
        <span className="text-xs text-zinc-500">PDF, Figma, ZIP, imagens… até 50 MB por ficheiro</span>
        <input
          ref={inputRef}
          type="file"
          name="files"
          multiple
          className="sr-only"
          onChange={(e) => setNames([...(e.target.files ?? [])].map((f) => f.name))}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <select name="lessonId" defaultValue="" className="field !w-auto max-w-full flex-1">
          <option value="">Materiais gerais do curso</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              Aula: {l.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending || !names.length} className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-50">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Anexar
        </button>
      </div>
      {state?.message && (
        <p className={cn("text-xs font-semibold", state.ok ? "text-emerald-700" : "text-rose-600")}>{state.message}</p>
      )}
    </form>
  );
}

export function FileRow({ file, lessons }: { file: FileData; lessons: { id: number; title: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-plum">
        <FileText size={16} />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = input.current?.value ?? "";
              start(async () => {
                await renameCourseFile(file.id, v);
                setEditing(false);
              });
            }}
            className="flex items-center gap-1"
          >
            <input ref={input} defaultValue={file.name} autoFocus className="field !py-1 !text-sm" />
            <button type="submit" className={iconBtn} aria-label="Guardar">
              <Check size={14} />
            </button>
          </form>
        ) : (
          <a href={`/api/ficheiros/${file.id}`} className="block truncate text-sm font-semibold text-zinc-900 hover:text-plum">
            {file.name}
          </a>
        )}
        <p className="text-[11px] text-zinc-500">
          {file.size} · {file.downloads} download(s)
        </p>
      </div>
      <select
        value={file.lessonId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = Number(e.target.value) || null;
          start(() => moveCourseFile(file.id, v));
        }}
        className="field !w-auto max-w-[180px] !py-1.5 !text-xs"
        title="Onde aparece para as alunas"
      >
        <option value="">Curso (geral)</option>
        {lessons.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-0.5">
        <a href={`/api/ficheiros/${file.id}`} className={iconBtn} title="Descarregar">
          <Download size={14} />
        </a>
        <button type="button" onClick={() => setEditing(true)} className={iconBtn} title="Renomear">
          <Pencil size={14} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm(`Apagar “${file.name}”?`) && start(() => deleteCourseFile(file.id))}
          className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}
          title="Apagar"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </li>
  );
}

export const QuizLink = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-plum hover:underline">
    <ListChecks size={12} /> {label}
  </Link>
);
