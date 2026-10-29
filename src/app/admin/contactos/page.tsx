import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Search, UserCheck, UserPlus, Users, X } from "lucide-react";
import { asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { channels, contacts, contactTags, interactions, tags } from "@/db/schema";
import { contactOrder, contactWhere, SORTS, type ContactFilters } from "@/lib/contacts-query";
import { EmptyState, PageHeader, StatCard } from "@/components/admin-ui";
import { ContactsTable, ImportButton, NewContactButton, type ContactRow } from "@/components/contacts-client";
import { countryName, flag } from "@/lib/timezones";
import { cn, CONTACT_STATUS, num, SOURCES } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// Valores de sql`` crus chegam como texto "AAAA-MM-DD HH:MM:SS" em UTC
const toIso = (v: string | Date) =>
  v instanceof Date ? v.toISOString() : new Date(`${String(v).replace(" ", "T")}Z`).toISOString();

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<ContactFilters & { page?: string; apagados?: string }>;
}) {
  const params = await searchParams;
  const filters: ContactFilters = {
    q: params.q,
    status: params.status,
    source: params.source,
    tag: params.tag,
    canal: params.canal,
    pais: params.pais,
    sort: params.sort,
  };
  const where = contactWhere(filters);
  const page = Math.max(1, Number(params.page) || 1);

  const [[{ total }], stats, allTags, channelRows, [{ noChannel }], countryRows] = await Promise.all([
    db.select({ total: count() }).from(contacts).where(where),
    db
      .select({
        all: count(),
        leads: sql<number>`count(*) filter (where ${contacts.status} in ('lead','qualified','negotiating'))`.mapWith(Number),
        clients: sql<number>`count(*) filter (where ${contacts.status} = 'client')`.mapWith(Number),
        recent: sql<number>`count(*) filter (where ${contacts.createdAt} > now() - interval '30 days')`.mapWith(Number),
      })
      .from(contacts)
      .then((r) => r[0]),
    db
      .select({ id: tags.id, name: tags.name, n: count(contactTags.contactId) })
      .from(tags)
      .leftJoin(contactTags, eq(contactTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(asc(tags.name)),
    db
      .select({ id: channels.id, name: channels.name, color: channels.color, count: count(contacts.id) })
      .from(channels)
      .leftJoin(contacts, eq(contacts.channelId, channels.id))
      .groupBy(channels.id)
      .orderBy(asc(channels.name)),
    db.select({ noChannel: count() }).from(contacts).where(isNull(contacts.channelId)),
    db
      .select({ country: contacts.country, n: count() })
      .from(contacts)
      .groupBy(contacts.country)
      .orderBy(sql`count(*) desc`),
  ]);
  const countries = countryRows.filter((r): r is { country: string; n: number } => Boolean(r.country));
  const noCountry = countryRows.find((r) => !r.country)?.n ?? 0;
  const channelOptions = channelRows.map(({ id, name, color }) => ({ id, name, color }));
  const byCount = [...channelRows].sort((a, b) => b.count - a.count);
  const withChannel = channelRows.reduce((sum, c) => sum + c.count, 0);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const lastActivity = sql<string | null>`(select max(${interactions.createdAt}) from ${interactions} where ${interactions.contactId} = ${contacts.id})`;

  const list = await db
    .select({ c: contacts, lastActivity })
    .from(contacts)
    .where(where)
    .orderBy(...contactOrder(filters.sort))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);

  const ids = list.map((r) => r.c.id);
  const tagRows = ids.length
    ? await db
        .select({ contactId: contactTags.contactId, id: tags.id, name: tags.name, color: tags.color })
        .from(contactTags)
        .innerJoin(tags, eq(tags.id, contactTags.tagId))
        .where(inArray(contactTags.contactId, ids))
    : [];

  const rows: ContactRow[] = list.map(({ c, lastActivity: la }) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    location: c.location,
    source: c.source,
    status: c.status,
    notes: c.notes,
    channelId: c.channelId,
    referredBy: c.referredBy,
    country: c.country,
    timezone: c.timezone,
    createdAt: c.createdAt.toISOString(),
    lastActivity: la ? toIso(la) : null,
    tags: tagRows.filter((t) => t.contactId === c.id).map(({ id, name, color }) => ({ id, name, color })),
  }));

  const active = Object.entries(filters).filter(([, v]) => v);
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...over })) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const exportHref = `/admin/crm/export${qs({ sort: undefined })}`;

  return (
    <>
      <PageHeader
        title="Contactos"
        subtitle="Gestão de todos os contactos da plataforma — site, WhatsApp, Hotmart, agendamentos e registo manual."
        actions={
          <>
            <ImportButton />
            <a href={exportHref} download className="btn-ghost !px-5 !py-2.5 !text-xs">
              <Download size={14} /> Exportar{active.length ? " filtrados" : ""}
            </a>
            <NewContactButton channels={channelOptions} />
          </>
        }
      />

      {params.apagados && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Contacto apagado.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de contactos" value={num(stats.all)} icon={<Users size={17} />} />
        <StatCard label="Leads em aberto" value={num(stats.leads)} hint="Lead, qualificado ou em negociação" icon={<UserPlus size={17} />} />
        <StatCard label="Clientes" value={num(stats.clients)} icon={<UserCheck size={17} />} accent />
        <StatCard label="Novos (30 dias)" value={num(stats.recent)} icon={<UserPlus size={17} />} />
      </div>

      {/* De onde vêm os contactos */}
      {withChannel > 0 && (
        <div className="card mb-6 p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">De onde vêm os contactos</p>
            <Link href="/admin/config?s=equipa#canais" className="text-xs font-semibold text-zinc-500 hover:text-plum">
              Gerir canais
            </Link>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
            {byCount.filter((c) => c.count > 0).map((c) => (
              <div key={c.id} style={{ width: `${(c.count / (withChannel + noChannel)) * 100}%`, background: c.color }} title={`${c.name}: ${c.count}`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {byCount.map((c) => (
              <Link
                key={c.id}
                href={`/admin/contactos?canal=${c.id}`}
                className={cn(
                  "flex items-center gap-2 text-sm transition-colors hover:text-plum",
                  filters.canal === String(c.id) ? "font-semibold text-plum" : "text-zinc-700"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.name} <span className="tabular-nums text-zinc-500">{num(c.count)}</span>
              </Link>
            ))}
            <Link href="/admin/contactos?canal=nenhum" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-plum">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" /> Sem canal <span className="tabular-nums">{num(noChannel)}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Clientes por país */}
      {countries.length > 0 && (
        <div className="card mb-6 p-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Contactos por país</p>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <Link
                key={c.country}
                href={`/admin/contactos?pais=${c.country}`}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-plum/40 hover:text-plum",
                  filters.pais === c.country ? "border-plum/50 bg-plum/[0.06] font-semibold text-plum" : "border-zinc-200 text-zinc-700"
                )}
              >
                <span className="text-base leading-none">{flag(c.country)}</span>
                {countryName(c.country)}
                <span className="tabular-nums text-zinc-500">{num(c.n)}</span>
                <span className="text-[10px] text-zinc-400">{Math.round((c.n / stats.all) * 100)}%</span>
              </Link>
            ))}
            {noCountry > 0 && (
              <Link href="/admin/contactos?pais=nenhum" className="flex items-center gap-2 rounded-full border border-dashed border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 hover:text-plum">
                Sem país <span className="tabular-nums">{num(noCountry)}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <Form action="/admin/contactos" className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Pesquisar nome, email, telefone ou cidade…"
            className="field !pl-10"
          />
        </div>
        <select name="status" defaultValue={filters.status ?? ""} className="field !w-auto">
          <option value="">Todos os estados</option>
          {Object.entries(CONTACT_STATUS).map(([v, s]) => (
            <option key={v} value={v}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={filters.source ?? ""} className="field !w-auto">
          <option value="">Todas as origens</option>
          {Object.entries(SOURCES).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select name="tag" defaultValue={filters.tag ?? ""} className="field !w-auto max-w-[220px]">
          <option value="">Todas as tags</option>
          {allTags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({num(t.n)})
            </option>
          ))}
        </select>
        <select name="canal" defaultValue={filters.canal ?? ""} className="field !w-auto max-w-[200px]">
          <option value="">Todos os canais</option>
          {channelRows.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({num(c.count)})
            </option>
          ))}
          <option value="nenhum">Sem canal ({num(noChannel)})</option>
        </select>
        <select name="pais" defaultValue={filters.pais ?? ""} className="field !w-auto max-w-[200px]">
          <option value="">Todos os países</option>
          {countries.map((c) => (
            <option key={c.country} value={c.country}>
              {flag(c.country)} {countryName(c.country)} ({num(c.n)})
            </option>
          ))}
          {noCountry > 0 && <option value="nenhum">Sem país ({num(noCountry)})</option>}
        </select>
        <select name="sort" defaultValue={filters.sort ?? "recent"} className="field !w-auto">
          {Object.entries(SORTS).map(([v, s]) => (
            <option key={v} value={v}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-dark !px-5 !py-2.5 !text-xs">
          Filtrar
        </button>
        {active.length > 0 && (
          <Link href="/admin/contactos" className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-plum">
            <X size={13} /> Limpar
          </Link>
        )}
      </Form>

      {rows.length === 0 ? (
        <EmptyState
          text={active.length ? "Nenhum contacto encontrado com estes filtros." : "Ainda não há contactos. Crie o primeiro ou importe um CSV."}
        />
      ) : (
        <ContactsTable rows={rows} allTags={allTags.map(({ id, name }) => ({ id, name }))} channels={channelOptions} />
      )}

      {/* Paginação */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
        <p>
          {total === 0
            ? "0 contactos"
            : `A mostrar ${num((current - 1) * PAGE_SIZE + 1)}–${num(Math.min(current * PAGE_SIZE, total))} de ${num(total)} contacto${total === 1 ? "" : "s"}`}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <PageLink href={qs({ page: current - 1 })} disabled={current <= 1}>
              <ChevronLeft size={15} />
            </PageLink>
            <span className="px-3 font-semibold text-zinc-700">
              {current} / {pages}
            </span>
            <PageLink href={qs({ page: current + 1 })} disabled={current >= pages}>
              <ChevronRight size={15} />
            </PageLink>
          </div>
        )}
      </div>
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  return disabled ? (
    <span className="rounded-lg border border-zinc-200 p-2 opacity-40">{children}</span>
  ) : (
    <Link href={`/admin/contactos${href}`} className="rounded-lg border border-zinc-200 bg-white p-2 transition-colors hover:border-plum/50 hover:text-plum">
      {children}
    </Link>
  );
}
