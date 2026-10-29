import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { num } from "@/lib/utils";

/**
 * Ficheiros dos cursos: guardados em ./uploads (fora de /public), com nome aleatório.
 * Só são servidos por /api/ficheiros/[id], que verifica a inscrição da aluna.
 */

export const MAX_FILE_BYTES = 50_000_000;

const DIR = path.join(process.cwd(), "uploads", "cursos");

export const filePath = (storedName: string) => path.join(DIR, path.basename(storedName));

export async function storeUpload(file: File) {
  await fs.mkdir(DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const stored = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(filePath(stored), Buffer.from(await file.arrayBuffer()));
  return stored;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${num(n / 1024)} KB`;
  return `${num(n / 1024 ** 2, 1)} MB`;
}
