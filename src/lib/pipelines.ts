import { readRaw } from "@/lib/settings";

/**
 * Lista de pipelines (separadores do quadro), guardada em settings. O id é o valor da coluna
 * pipeline_stages.pipeline; o nome pode mudar sem tocar nas fases nem nos negócios.
 */

export const PIPELINES_KEY = "pipelines";

export type Pipeline = { id: string; label: string };

const DEFAULTS: Pipeline[] = [
  { id: "mentoria", label: "Mentoria 1:1" },
  { id: "workshops", label: "Workshops & Cursos" },
];

export async function getPipelines(): Promise<Pipeline[]> {
  const raw = await readRaw([PIPELINES_KEY]);
  try {
    const list = JSON.parse(raw[PIPELINES_KEY] ?? "") as Pipeline[];
    return Array.isArray(list) && list.length ? list : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
