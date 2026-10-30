"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { storeUpload } from "@/lib/files";
import { deleteSettings, saveSettings } from "@/lib/settings";
import { SITE_DEFAULTS, pageDef, settingKey, type SectionValues, type SiteField, type SitePageId, type StoredPage } from "@/lib/site-def";

export type SiteResult = { ok: boolean; error?: string; savedAt?: number };

const MAX_TEXT = 5000;
const MAX_ITEMS = 40;
const IMAGE_BYTES = 8_000_000;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT) : "");
// Links e imagens aceites: caminhos do site, https, mailto e tel
const safeUrl = (u: string) => !u || /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(u);

function readField(f: SiteField, v: unknown): { value?: SectionValues[string]; error?: string } {
  if (f.type === "strings") {
    if (!Array.isArray(v)) return {};
    return { value: v.map(clean).filter(Boolean).slice(0, MAX_ITEMS) };
  }
  if (f.type === "list") {
    if (!Array.isArray(v)) return {};
    const items: Record<string, string>[] = [];
    for (const raw of v.slice(0, MAX_ITEMS)) {
      if (!raw || typeof raw !== "object") continue;
      const item: Record<string, string> = {};
      for (const sub of f.fields ?? []) {
        const r = readField(sub, (raw as Record<string, unknown>)[sub.key]);
        if (r.error) return r;
        item[sub.key] = typeof r.value === "string" ? r.value : "";
      }
      if (Object.values(item).some(Boolean)) items.push(item);
    }
    return { value: items };
  }
  const s = clean(v);
  if (f.type === "toggle") return { value: s === "1" ? "1" : "0" };
  if ((f.type === "url" || f.type === "image") && !safeUrl(s)) return { error: `“${f.label}” tem de ser um caminho do site (/…), um link https ou um email.` };
  return { value: s };
}

export async function saveSitePage(id: SitePageId, data: StoredPage): Promise<SiteResult> {
  await requireAdmin();
  const def = pageDef(id);
  if (!def || !(id in SITE_DEFAULTS)) return { ok: false, error: "Página desconhecida." };

  const ids = def.sections.map((s) => s.id);
  const out: StoredPage = { sections: {} };
  for (const sec of def.sections) {
    const values: SectionValues = {};
    const got = data.sections?.[sec.id] ?? {};
    for (const f of sec.fields) {
      const r = readField(f, (got as Record<string, unknown>)[f.key]);
      if (r.error) return { ok: false, error: `${sec.label}: ${r.error}` };
      if (r.value !== undefined) values[f.key] = r.value;
    }
    out.sections![sec.id] = values;
  }
  if (def.seo) out.seo = { title: clean(data.seo?.title).slice(0, 120), description: clean(data.seo?.description).slice(0, 320) };
  if (!def.fixed) {
    out.order = (data.order ?? []).filter((x) => ids.includes(x));
    out.hidden = (data.hidden ?? []).filter((x) => ids.includes(x));
  }

  await saveSettings({ [settingKey(id)]: JSON.stringify(out) });
  revalidatePath("/", "layout");
  return { ok: true, savedAt: Date.now() };
}

/** Volta a página toda ao texto original. */
export async function resetSitePage(id: SitePageId): Promise<SiteResult> {
  await requireAdmin();
  if (!(id in SITE_DEFAULTS)) return { ok: false, error: "Página desconhecida." };
  await deleteSettings([settingKey(id)]);
  revalidatePath("/", "layout");
  return { ok: true, savedAt: Date.now() };
}

export async function uploadSiteImage(fd: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma imagem." };
  if (!IMAGE_EXT.test(file.name) || !file.type.startsWith("image/")) return { ok: false, error: "Formato aceite: JPG, PNG, WEBP, GIF ou AVIF." };
  if (file.size > IMAGE_BYTES) return { ok: false, error: "A imagem tem de ter até 8 MB." };
  const stored = await storeUpload(file, "site");
  return { ok: true, url: `/api/imagens/${stored}` };
}
