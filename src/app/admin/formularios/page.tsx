import Link from "next/link";
import { ClipboardList, ExternalLink, Inbox, MailOpen, Percent } from "lucide-react";
import { asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { formSubmissions, forms } from "@/db/schema";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/admin-ui";
import { CopyButton } from "@/components/admin-client";
import { FormActions, NewFormButton } from "@/components/forms-admin";
import { getContactForm } from "@/lib/forms";
import { formPath } from "@/lib/forms-def";
import { appUrl } from "@/lib/settings";
import { fmtDateTime, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

const rate = (responses: number, views: number) => (views ? `${Math.min(100, Math.round((responses / views) * 100))}%` : "—");

export default async function FormulariosPage() {
  await getContactForm();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [rows, stats, [{ recentCount }], latest, base] = await Promise.all([
    db.select().from(forms).orderBy(sql`${forms.key} is null`, asc(forms.name)),
    db
      .select({
        formId: formSubmissions.formId,
        total: count(),
        unread: sql<number>`count(*) filter (where ${formSubmissions.status} = 'new')`.mapWith(Number),
      })
      .from(formSubmissions)
      .groupBy(formSubmissions.formId),
    db.select({ recentCount: count() }).from(formSubmissions).where(gte(formSubmissions.createdAt, since)),
    db
      .select({ s: formSubmissions, form: forms.name })
      .from(formSubmissions)
      .innerJoin(forms, eq(forms.id, formSubmissions.formId))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(8),
    appUrl(),
  ]);
  const by = new Map(stats.map((s) => [s.formId, s]));
  const total = stats.reduce((a, s) => a + s.total, 0);
  const unread = stats.reduce((a, s) => a + s.unread, 0);
  const views = rows.reduce((a, f) => a + f.views, 0);

  return (
    <>
      <PageHeader
        title="Formulários"
        subtitle="Crie páginas de captação e gira o formulário da página Contacto. Cada resposta entra nos Contactos."
        actions={<NewFormButton />}
      />
      <div className="mb-6 stat-row grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Formulários ativos" value={num(rows.filter((f) => f.active).length)} icon={<ClipboardList size={16} />} />
        <StatCard label="Respostas em 30 dias" value={num(recentCount)} hint={`${num(total)} no total`} icon={<Inbox size={16} />} />
        <StatCard label="Por ler" value={num(unread)} icon={<MailOpen size={16} />} accent={unread > 0} />
        <StatCard label="Conversão" value={rate(total, views)} hint={`${num(views)} ${views === 1 ? "visita" : "visitas"}`} icon={<Percent size={16} />} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Os seus formulários">
          <ul className="divide-y divide-line">
            {rows.map((f) => {
              const s = by.get(f.id);
              const path = formPath(f);
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/formularios/${f.id}`} className="truncate text-sm font-semibold text-zinc-900 hover:text-plum">
                        {f.name}
                      </Link>
                      {f.key && <Badge label="Página Contacto" />}
                      {!f.active && <Badge label="Inativo" />}
                      {!!s?.unread && <Badge label={`${s.unread} por ler`} className="!border-plum/30 !bg-plum/10 !text-plum" />}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {num(s?.total ?? 0)} {s?.total === 1 ? "resposta" : "respostas"} · {num(f.views)} {f.views === 1 ? "visita" : "visitas"} · conversão {rate(s?.total ?? 0, f.views)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CopyButton text={`${base}${path}`} label="Link" />
                    <a href={path} target="_blank" rel="noreferrer" aria-label="Abrir página" title="Abrir página" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-plum">
                      <ExternalLink size={15} />
                    </a>
                    <FormActions id={f.id} name={f.name} active={f.active} system={!!f.key} responses={s?.total ?? 0} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="Últimas respostas">
          {latest.length === 0 ? (
            <EmptyState text="Ainda não há respostas. Partilhe o link de um formulário para começar." />
          ) : (
            <ul className="divide-y divide-line">
              {latest.map(({ s, form }) => (
                <li key={s.id}>
                  <Link href={`/admin/formularios/${s.formId}`} className="block py-2.5 first:pt-0 hover:text-plum">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-zinc-900">{s.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{fmtDateTime(s.createdAt)}</span>
                    </span>
                    <span className="block truncate text-xs text-zinc-500">{form}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
