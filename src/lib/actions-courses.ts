"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, lt, desc } from "drizzle-orm";
import { db } from "@/db";
import { courseFiles, courses, lessons, modules } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { filePath, MAX_FILE_BYTES, storeUpload } from "@/lib/files";

export type CourseFormResult = { ok: boolean; error?: string; savedAt?: number };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (s: string) => s || null;
const isUrl = (s: string) => !s || /^(https?:\/\/|\/)/i.test(s);

function refreshCourse(courseId: number) {
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/admin/cursos");
  revalidatePath(`/aluno/curso/${courseId}`);
  revalidatePath("/aluno");
  revalidatePath("/cursos");
}

async function courseOfModule(moduleId: number) {
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  return m ?? null;
}

async function courseOfLesson(lessonId: number) {
  const [row] = await db
    .select({ lesson: lessons, courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row ?? null;
}

/* -------------------------------- CURSO --------------------------------- */

export async function updateCourse(id: number, _prev: CourseFormResult | null, fd: FormData): Promise<CourseFormResult> {
  await requireAdmin();
  const title = str(fd, "title");
  const slug = str(fd, "slug")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const price = Number(str(fd, "price").replace(",", "."));
  if (!title) return { ok: false, error: "Indique o título." };
  if (!slug) return { ok: false, error: "Indique o endereço (slug)." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Preço inválido." };
  const cover = str(fd, "cover");
  const hotmartUrl = str(fd, "hotmartUrl");
  if (!isUrl(cover) || !isUrl(hotmartUrl)) return { ok: false, error: "Os links têm de começar por https:// ou /." };
  const [clash] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).limit(1);
  if (clash && clash.id !== id) return { ok: false, error: "Já existe outro curso com este endereço." };
  await db
    .update(courses)
    .set({
      title,
      slug,
      subtitle: orNull(str(fd, "subtitle")),
      description: orNull(str(fd, "description")),
      level: str(fd, "level") || "Todos os níveis",
      price: price.toFixed(2),
      cover: orNull(cover),
      hotmartUrl: orNull(hotmartUrl),
    })
    .where(eq(courses.id, id));
  refreshCourse(id);
  return { ok: true, savedAt: Date.now() };
}

/* ------------------------------- MÓDULOS -------------------------------- */

export async function renameModule(id: number, title: string) {
  await requireAdmin();
  const m = await courseOfModule(id);
  if (!m || !title.trim()) return;
  await db.update(modules).set({ title: title.trim() }).where(eq(modules.id, id));
  refreshCourse(m.courseId);
}

export async function deleteModule(id: number) {
  await requireAdmin();
  const m = await courseOfModule(id);
  if (!m) return;
  const files = await db
    .select({ storedName: courseFiles.storedName })
    .from(courseFiles)
    .innerJoin(lessons, eq(lessons.id, courseFiles.lessonId))
    .where(eq(lessons.moduleId, id));
  await db.delete(modules).where(eq(modules.id, id));
  await Promise.all(files.map((f) => fs.rm(filePath(f.storedName), { force: true })));
  refreshCourse(m.courseId);
}

/** Troca a posição com o módulo vizinho (dir -1 = subir). */
export async function moveModule(id: number, dir: -1 | 1) {
  await requireAdmin();
  const m = await courseOfModule(id);
  if (!m) return;
  const [other] = await db
    .select()
    .from(modules)
    .where(and(eq(modules.courseId, m.courseId), dir < 0 ? lt(modules.order, m.order) : gt(modules.order, m.order)))
    .orderBy(dir < 0 ? desc(modules.order) : asc(modules.order))
    .limit(1);
  if (!other) return;
  await db.update(modules).set({ order: other.order }).where(eq(modules.id, m.id));
  await db.update(modules).set({ order: m.order }).where(eq(modules.id, other.id));
  refreshCourse(m.courseId);
}

/* -------------------------------- AULAS --------------------------------- */

export async function updateLesson(id: number, _prev: CourseFormResult | null, fd: FormData): Promise<CourseFormResult> {
  await requireAdmin();
  const found = await courseOfLesson(id);
  if (!found) return { ok: false, error: "Aula não encontrada." };
  const title = str(fd, "title");
  if (!title) return { ok: false, error: "Indique o título." };
  const videoUrl = str(fd, "videoUrl");
  const materialUrl = str(fd, "materialUrl");
  if (!isUrl(videoUrl) || !isUrl(materialUrl)) return { ok: false, error: "Os links têm de começar por https:// ou /." };
  const typeRaw = str(fd, "type");
  const type = (["video", "material", "quiz"].includes(typeRaw) ? typeRaw : found.lesson.type) as typeof found.lesson.type;
  if (type === "video" && !videoUrl) return { ok: false, error: "Indique o link do vídeo." };
  const moduleId = Number(fd.get("moduleId")) || found.lesson.moduleId;
  const target = moduleId !== found.lesson.moduleId ? await courseOfModule(moduleId) : null;
  if (target && target.courseId !== found.courseId) return { ok: false, error: "Módulo inválido." };

  await db
    .update(lessons)
    .set({
      title,
      type,
      moduleId,
      durationMin: Math.max(1, Math.round(Number(str(fd, "durationMin")) || found.lesson.durationMin)),
      videoUrl: orNull(videoUrl),
      materialUrl: orNull(materialUrl),
      content: orNull(str(fd, "content")),
    })
    .where(eq(lessons.id, id));
  refreshCourse(found.courseId);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteLesson(id: number) {
  await requireAdmin();
  const found = await courseOfLesson(id);
  if (!found) return;
  // Os ficheiros da aula são apagados em cascata na base de dados; remove-os também do disco
  const files = await db.select().from(courseFiles).where(eq(courseFiles.lessonId, id));
  await db.delete(lessons).where(eq(lessons.id, id));
  await Promise.all(files.map((f) => fs.rm(filePath(f.storedName), { force: true })));
  refreshCourse(found.courseId);
}

export async function moveLesson(id: number, dir: -1 | 1) {
  await requireAdmin();
  const found = await courseOfLesson(id);
  if (!found) return;
  const l = found.lesson;
  const [other] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.moduleId, l.moduleId), dir < 0 ? lt(lessons.order, l.order) : gt(lessons.order, l.order)))
    .orderBy(dir < 0 ? desc(lessons.order) : asc(lessons.order))
    .limit(1);
  if (!other) return;
  await db.update(lessons).set({ order: other.order }).where(eq(lessons.id, l.id));
  await db.update(lessons).set({ order: l.order }).where(eq(lessons.id, other.id));
  refreshCourse(found.courseId);
}

/* ------------------------------ FICHEIROS ------------------------------- */

export type UploadResult = { ok: boolean; message?: string; savedAt?: number };

export async function uploadCourseFiles(courseId: number, _prev: UploadResult | null, fd: FormData): Promise<UploadResult> {
  await requireAdmin();
  const lessonId = Number(fd.get("lessonId")) || null;
  if (lessonId) {
    const found = await courseOfLesson(lessonId);
    if (!found || found.courseId !== courseId) return { ok: false, message: "Aula inválida." };
  }
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: "Escolha pelo menos um ficheiro." };
  const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
  if (tooBig) return { ok: false, message: `“${tooBig.name}” excede ${MAX_FILE_BYTES / 1_000_000} MB.` };

  for (const file of files) {
    const stored = await storeUpload(file);
    await db.insert(courseFiles).values({
      courseId,
      lessonId,
      name: file.name.slice(0, 200),
      storedName: stored,
      mime: file.type || "application/octet-stream",
      size: file.size,
    });
  }
  refreshCourse(courseId);
  return { ok: true, message: `${files.length} ficheiro(s) anexado(s).`, savedAt: Date.now() };
}

export async function renameCourseFile(id: number, name: string) {
  await requireAdmin();
  const [f] = await db.select().from(courseFiles).where(eq(courseFiles.id, id)).limit(1);
  if (!f || !name.trim()) return;
  await db.update(courseFiles).set({ name: name.trim().slice(0, 200) }).where(eq(courseFiles.id, id));
  refreshCourse(f.courseId);
}

export async function moveCourseFile(id: number, lessonId: number | null) {
  await requireAdmin();
  const [f] = await db.select().from(courseFiles).where(eq(courseFiles.id, id)).limit(1);
  if (!f) return;
  if (lessonId) {
    const found = await courseOfLesson(lessonId);
    if (!found || found.courseId !== f.courseId) return;
  }
  await db.update(courseFiles).set({ lessonId }).where(eq(courseFiles.id, id));
  refreshCourse(f.courseId);
}

export async function deleteCourseFile(id: number) {
  await requireAdmin();
  const [f] = await db.delete(courseFiles).where(eq(courseFiles.id, id)).returning();
  if (!f) return;
  await fs.rm(filePath(f.storedName), { force: true });
  refreshCourse(f.courseId);
}
