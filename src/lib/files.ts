import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { num } from "@/lib/utils";

/**
 * Ficheiros guardados em ./uploads/<pasta> (fora de /public), com nome aleatório:
 *  - cursos: servidos por /api/ficheiros/[id], que verifica a inscrição da aluna;
 *  - comprovativos: recibos de pagamentos e despesas, só para a equipa;
 *  - site: imagens do site público, servidas sem sessão por /api/imagens/[nome];
 *  - whatsapp: fotos, áudios e documentos das conversas, só para a equipa.
 */

export const MAX_FILE_BYTES = 50_000_000;

export type UploadFolder = "cursos" | "comprovativos" | "site" | "whatsapp";

const dirOf = (folder: UploadFolder) => path.join(process.cwd(), "uploads", folder);

export const filePath = (storedName: string, folder: UploadFolder = "cursos") =>
  path.join(dirOf(folder), path.basename(storedName));

export async function storeUpload(file: File, folder: UploadFolder = "cursos") {
  await fs.mkdir(dirOf(folder), { recursive: true });
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const stored = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(filePath(stored, folder), Buffer.from(await file.arrayBuffer()));
  return stored;
}

/** Guarda bytes já em memória (ex: ficheiro descarregado da Evolution) e devolve o nome guardado. */
export async function storeBuffer(data: Buffer, ext: string, folder: UploadFolder) {
  await fs.mkdir(dirOf(folder), { recursive: true });
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const stored = `${crypto.randomUUID()}${clean ? `.${clean}` : ""}`;
  await fs.writeFile(filePath(stored, folder), data);
  return stored;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${num(n / 1024)} KB`;
  return `${num(n / 1024 ** 2, 1)} MB`;
}
