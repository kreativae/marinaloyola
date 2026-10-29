import crypto from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { SERVICES, type FieldDef } from "@/lib/services-def";

/**
 * Leitura das configurações: valor guardado na tabela settings → variável de ambiente → valor por omissão.
 */

const FIELDS: Record<string, FieldDef> = Object.fromEntries(
  SERVICES.flatMap((s) => s.fields.map((f) => [f.key, f]))
);

export async function readRaw(keys: string[]): Promise<Record<string, string>> {
  if (!keys.length) return {};
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function resolve(key: string, stored: string | undefined) {
  const f = FIELDS[key];
  const env = f?.env ? process.env[f.env] : undefined;
  // Num toggle, "0" guardado é uma escolha explícita
  if (f?.type === "toggle") return stored ?? env ?? f.default ?? "0";
  return stored || env || f?.default || "";
}

export async function getSettings<K extends string>(keys: readonly K[]): Promise<Record<K, string>> {
  const raw = await readRaw([...keys]);
  return Object.fromEntries(keys.map((k) => [k, resolve(k, raw[k])])) as Record<K, string>;
}

export async function getSetting(key: string) {
  return (await getSettings([key]))[key];
}

export async function saveSettings(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

export async function deleteSettings(keys: string[]) {
  if (keys.length) await db.delete(settings).where(inArray(settings.key, keys));
}

/** Token aleatório persistente (webhooks, feeds); criado na primeira leitura. */
export async function getToken(key: string, regenerate = false) {
  if (!regenerate) {
    const raw = await readRaw([key]);
    if (raw[key]) return raw[key];
  }
  const value = crypto.randomBytes(18).toString("hex");
  await saveSettings({ [key]: value });
  return value;
}

export const isOn = (v: string | undefined) => v === "1";

export const appUrl = async () => (await getSetting("app_url")).replace(/\/+$/, "");
