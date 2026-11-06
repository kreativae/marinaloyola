import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Search } from "lucide-react";
import { and, asc, count, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { channels, formSubmissions, forms, tags } from "@/db/schema";
import { EmptyState, PageHeader, Panel } from "@/components/admin-ui";
import { CopyButton } from "@/components/admin-client";
import { FormActions, FormBuilder, FormSettings, MarkAllReadButton, SubmissionsTable } from "@/components/forms-admin";
import { formPath, SUBMISSION_STATUS } from "@/lib/forms-def";
import { appUrl } from "@/lib/settings";
import { cn, fmtDateTime, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE = 50;
const TABS = [
  { id: "respostas", label: "Respostas" },
  { id: "editor", label: "Editor" },
  { id: "definicoes", label: "Definições" },
];

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; estado?: string; p?: string }>;
}) {
  const [{ id: rawId }, sp] = await Promise.all([params, searchParams]);
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const [form] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  if (!form) notFound();

  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "respostas";
  const [base, statusRows] = await Promise.all([
    appUrl(),
    db.select({ status: formSubmissions.status, n: count() }).from(formSubmissions).where(eq(formSubmissions.formId, id)).groupBy(formSubmissions.status),
  ]);
  const counts = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));
  const total = statusRows.reduce((a, r) => a + r.n, 0);
  const path = formPath(form);
  const system = !!form.key;

  return (
    <>
      <Link href="/admin/formularios" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-plum">
        <ArrowLeft size={13} /> Formulários
      </Link>
      <PageHeader
        title={form.name}
        subtitle={form.active ? `${base}${path}` : "Inativo: a página não abre nem recebe respostas."}
        actions={
          <>
            <CopyButton text={`${base}${path}`} label="Copiar link" />
            <a href={path} target="_blank" rel="noreferrer" className="btn-ghost !px-3.5 !py-2 !text-xs">
              <ExternalLink size={13} /> Ver página
            </a>
            <FormActions id={form.id} name={form.name} active={form.active} system={system} responses={total} afterDelete="/admin/formularios" />
          </>
        }
      />
      <nav className="mb-6 flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/formularios/${id}?tab=${t.id}`}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
              tab === t.id ? "border-plum bg-plum text-white" : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900"
            )}
          >
            {t.label}
            {t.id === "respostas" && <span className="ml-1.5 opacity-60">{num(total)}</span>}
          </Link>
        ))}
      </nav>
      {tab === "respostas" && <Responses id={id} sp={sp} counts={counts} />}
      {tab === "editor" && (
        <FormBuilder
          id={id}
          system={system}
          initial={{ kicker: form.kicker, title: form.title, description: form.description, button: form.button, fields: form.fields }}
        />
      )}
      {tab === "definicoes" && <Settings form={form} base={base} />}
    </>
  );
}

async function Responses({ id, sp, counts }: { id: number; sp: { q?: string; estado?: string; p?: string }; counts: Record<string, number> }) {
  const q = (sp.q ?? "").trim().slice(0, 100);
  const estado = sp.estado && SUBMISSION_STATUS[sp.estado] ? sp.estado : "";
  const page = Math.max(1, Number(sp.p) || 1);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const filters: (SQL | undefined)[] = [
    eq(formSubmissions.formId, id),
    estado ? eq(formSubmissions.status, estado) : ne(formSubmissions.status, "archived"),
    q ? or(ilike(formSubmissions.name, like), ilike(formSubmissions.email, like), sql`${formSubmissions.answers}::text ilike ${like}`) : undefined,
  ];
  const where = and(...filters);
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(formSubmissions).where(where).orderBy(desc(formSubmissions.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: count() }).from(formSubmissions).where(where),
  ]);
  const href = (patch: Record<string, string>) => {
    const u = new URLSearchParams({ tab: "respostas", ...(q && { q }), ...(estado && { estado }), ...patch });
    if (!patch.estado && patch.estado !== undefined) u.delete("estado");
    return `/admin/formularios/${id}?${u}`;
  };
  const pills = [["", "Em aberto", (counts.new ?? 0) + (counts.read ?? 0)], ...Object.entries(SUBMISSION_STATUS).map(([k, l]) => [k, l, counts[k] ?? 0])] as [string, string, number][];
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Form action={`/admin/formularios/${id}`} className="relative min-w-[220px] flex-1">
          <input type="hidden" name="tab" value="respostas" />
          {estado && <input type="hidden" name="estado" value={estado} />}
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input name="q" defaultValue={q} placeholder="Procurar em nomes, emails e respostas" className="field !pl-10" />
        </Form>
        <div className="flex flex-wrap gap-1.5">
          {pills.map(([k, l, c]) => (
            <Link
              key={k}
              href={href({ estado: k, p: "1" })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                estado === k ? "border-plum bg-plum text-white" : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900"
              )}
            >
              {l} <span className="opacity-60">{num(c)}</span>
            </Link>
          ))}
        </div>
        {!!counts.new && <MarkAllReadButton formId={id} />}
        <a href={`/admin/formularios/${id}/export`} className="btn-ghost !px-3.5 !py-2 !text-xs">
          <Download size={13} /> Exportar CSV
        </a>
      </div>
      {rows.length === 0 ? (
        <EmptyState text={q || estado ? "Nenhuma resposta com estes filtros." : "Ainda não há respostas neste formulário."} />
      ) : (
        <SubmissionsTable
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone,
            answers: r.answers,
            status: r.status,
            origin: r.origin,
            contactId: r.contactId,
            when: fmtDateTime(r.createdAt), // formatada no servidor: o fuso do browser pode ser outro
          }))}
        />
      )}
      {n > PAGE && (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {num((page - 1) * PAGE + 1)}–{num(Math.min(page * PAGE, n))} de {num(n)}
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={href({ p: String(page - 1) })} className="btn-ghost !px-3 !py-1.5 !text-xs">
                Anteriores
              </Link>
            )}
            {page * PAGE < n && (
              <Link href={href({ p: String(page + 1) })} className="btn-ghost !px-3 !py-1.5 !text-xs">
                Seguintes
              </Link>
            )}
          </span>
        </div>
      )}
    </Panel>
  );
}

async function Settings({ form, base }: { form: typeof forms.$inferSelect; base: string }) {
  const [channelRows, tagRows] = await Promise.all([
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(asc(channels.name)),
    db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);
  return (
    <FormSettings
      id={form.id}
      system={!!form.key}
      baseUrl={base}
      channels={channelRows}
      tags={tagRows.map((t) => t.name)}
      values={{
        name: form.name,
        slug: form.slug,
        active: form.active,
        tag: form.tag ?? "",
        channelId: form.channelId,
        createDeal: form.createDeal,
        notify: form.notify,
        successTitle: form.successTitle,
        successText: form.successText,
        successCtaLabel: form.successCtaLabel,
        successCtaHref: form.successCtaHref,
        autoReply: form.autoReply,
        autoReplySubject: form.autoReplySubject,
        autoReplyText: form.autoReplyText,
      }}
    />
  );
}
