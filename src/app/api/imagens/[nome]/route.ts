import fs from "node:fs/promises";
import path from "node:path";
import { filePath } from "@/lib/files";

/** Imagens do site público enviadas pelo backoffice (uploads/site). Nome aleatório, por isso cache longa. */

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params;
  const type = TYPES[path.extname(nome).toLowerCase()];
  if (!type) return new Response("Não encontrado", { status: 404 });
  let data: Buffer;
  try {
    data = await fs.readFile(filePath(nome, "site"));
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
