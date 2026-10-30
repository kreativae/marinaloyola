import { PageHeader } from "@/components/admin-ui";
import { SiteEditor, type EditorData } from "@/components/site-admin";
import { readRaw } from "@/lib/settings";
import { mergePage, parseStored } from "@/lib/site-content";
import { SITE_PAGES, settingKey, type SectionValues } from "@/lib/site-def";

export const dynamic = "force-dynamic";

export default async function SiteAdminPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const page = SITE_PAGES.find((x) => x.id === p) ?? SITE_PAGES[1];
  const raw = await readRaw(SITE_PAGES.map((x) => settingKey(x.id)));
  const stored = raw[settingKey(page.id)];
  const merged = mergePage(page.id, parseStored(stored));

  const initial: EditorData = {
    seo: merged.seo,
    order: merged.order,
    hidden: merged.hidden,
    sections: merged.s as unknown as Record<string, SectionValues>,
  };

  return (
    <>
      <PageHeader
        title="Site"
        subtitle="Edite textos, fotos e blocos de todas as páginas do site. Esconda ou reordene secções e veja o resultado ao lado."
      />
      <SiteEditor key={page.id} pages={SITE_PAGES.map((x) => ({ ...x, edited: Boolean(raw[settingKey(x.id)]) }))} page={page} initial={initial} customized={Boolean(stored)} />
    </>
  );
}
