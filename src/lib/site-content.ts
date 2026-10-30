import { cache } from "react";
import type { Metadata } from "next";
import { readRaw } from "@/lib/settings";
import { SITE_DEFAULTS, settingKey, type SiteDefaults, type SitePageId, type StoredPage } from "@/lib/site-def";

/**
 * Conteúdo do site público: texto original (site-def) com o que foi editado no backoffice por cima.
 * Cada página fica guardada como JSON numa linha da tabela settings (`site_page_<id>`).
 */

type Sections<P extends SitePageId> = Omit<SiteDefaults[P], "seo">;

export type SitePage<P extends SitePageId> = {
  seo: { title: string; description: string };
  order: string[];
  hidden: string[];
  s: Sections<P>;
};

export function parseStored(raw: string | undefined): StoredPage {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as StoredPage) : {};
  } catch {
    return {};
  }
}

/** Junta o guardado com o original, campo a campo; só aceita o mesmo tipo (texto ↔ texto, lista ↔ lista). */
export function mergePage<P extends SitePageId>(id: P, stored: StoredPage): SitePage<P> {
  const defaults = SITE_DEFAULTS[id] as Record<string, Record<string, unknown>>;
  const ids = Object.keys(defaults).filter((k) => k !== "seo");
  const s: Record<string, Record<string, unknown>> = {};
  for (const sec of ids) {
    const base = defaults[sec];
    const saved = stored.sections?.[sec] ?? {};
    s[sec] = Object.fromEntries(
      Object.entries(base).map(([k, v]) => {
        const got = (saved as Record<string, unknown>)[k];
        const same = Array.isArray(v) ? Array.isArray(got) : typeof got === "string";
        return [k, same ? got : v];
      })
    );
  }
  const order = [...(stored.order ?? []).filter((x) => ids.includes(x)), ...ids.filter((x) => !(stored.order ?? []).includes(x))];
  const seo = defaults.seo as { title: string; description: string };
  return {
    seo: { title: stored.seo?.title || seo.title, description: stored.seo?.description || seo.description },
    order,
    hidden: (stored.hidden ?? []).filter((x) => ids.includes(x)),
    s: s as unknown as Sections<P>,
  };
}

async function load<P extends SitePageId>(id: P): Promise<SitePage<P>> {
  let raw: string | undefined;
  try {
    raw = (await readRaw([settingKey(id)]))[settingKey(id)];
  } catch {
    // Sem base de dados (ex.: durante o build) fica o texto original
  }
  return mergePage(id, parseStored(raw));
}

export const getSitePage = cache(load) as <P extends SitePageId>(id: P) => Promise<SitePage<P>>;

/** Título e descrição da página para o Google e partilhas. */
export async function siteMetadata(id: SitePageId): Promise<Metadata> {
  const { seo } = await getSitePage(id);
  return { ...(seo.title && { title: seo.title }), ...(seo.description && { description: seo.description }) };
}
