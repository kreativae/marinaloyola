import fs from "node:fs/promises";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { courseFiles, enrollments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { filePath } from "@/lib/files";
import { fileHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Download de um anexo de curso: equipa ou aluna inscrita no curso. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const { id } = await params;
  const [file] = await db.select().from(courseFiles).where(eq(courseFiles.id, Number(id) || 0)).limit(1);
  if (!file) return new Response("Não encontrado", { status: 404 });

  if (user.role === "student") {
    const [enrolled] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, file.courseId)))
      .limit(1);
    if (!enrolled) return new Response("Sem acesso", { status: 403 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(filePath(file.storedName));
  } catch {
    return new Response("Ficheiro em falta no servidor", { status: 410 });
  }
  if (user.role === "student") {
    await db.update(courseFiles).set({ downloads: sql`${courseFiles.downloads} + 1` }).where(eq(courseFiles.id, file.id));
  }
  // ?ver=1 abre no browser (PDF, imagens); por omissão descarrega
  const inline = new URL(req.url).searchParams.get("ver") === "1";
  return new Response(new Uint8Array(data), {
    headers: {
      ...fileHeaders(file.mime, file.name, inline),
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
    },
  });
}
