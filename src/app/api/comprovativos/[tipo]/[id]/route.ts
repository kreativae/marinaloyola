import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses, payments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { filePath } from "@/lib/files";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Comprovativo de um pagamento ou despesa — só para a equipa. Abre no browser. */
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role === "student") return new Response("Não autorizado", { status: 401 });
  const { tipo, id } = await params;
  const table = tipo === "despesa" ? expenses : tipo === "pagamento" ? payments : null;
  if (!table) return new Response("Não encontrado", { status: 404 });
  const [row] = await db
    .select({ name: table.receiptName, file: table.receiptFile })
    .from(table)
    .where(eq(table.id, Number(id)))
    .limit(1);
  if (!row?.file) return new Response("Sem comprovativo", { status: 404 });
  let data: Buffer;
  try {
    data = await fs.readFile(filePath(row.file, "comprovativos"));
  } catch {
    return new Response("Ficheiro em falta no servidor", { status: 410 });
  }
  const ext = row.file.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `${MIME[ext] ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name ?? "comprovativo")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
