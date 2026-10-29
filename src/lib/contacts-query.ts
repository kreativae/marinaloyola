import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { contacts, contactTags } from "@/db/schema";
import { CONTACT_STATUS, SOURCES } from "@/lib/utils";

export type ContactFilters = {
  q?: string;
  status?: string;
  source?: string;
  tag?: string;
  canal?: string;
  pais?: string;
  /** Vista rápida: leads | clientes | novos | parados */
  vista?: string;
  sort?: string;
  ids?: string;
};

type ContactStatus = (typeof contacts.$inferSelect)["status"];
type Source = (typeof contacts.$inferSelect)["source"];

export const SORTS: Record<string, { label: string; order: SQL[] }> = {
  recent: { label: "Mais recentes", order: [desc(contacts.createdAt), desc(contacts.id)] },
  oldest: { label: "Mais antigos", order: [asc(contacts.createdAt), asc(contacts.id)] },
  name: { label: "Nome (A–Z)", order: [asc(contacts.name)] },
};

/** Condições de filtro partilhadas pela lista de contactos e pela exportação CSV. */
export function contactWhere(f: ContactFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    conds.push(
      or(
        ilike(contacts.name, `%${q}%`),
        ilike(contacts.email, `%${q}%`),
        ilike(contacts.location, `%${q}%`),
        ilike(contacts.referredBy, `%${q}%`),
        digits.length >= 3
          ? sql`regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g') LIKE ${`%${digits}%`}`
          : undefined
      )
    );
  }
  if (f.status && f.status in CONTACT_STATUS) conds.push(eq(contacts.status, f.status as ContactStatus));
  if (f.source && f.source in SOURCES) conds.push(eq(contacts.source, f.source as Source));
  const tagId = Number(f.tag);
  if (Number.isInteger(tagId) && tagId > 0) {
    conds.push(
      sql`exists (select 1 from ${contactTags} where ${contactTags.contactId} = ${contacts.id} and ${contactTags.tagId} = ${tagId})`
    );
  }
  if (f.vista === "leads") conds.push(sql`${contacts.status} in ('lead','qualified','negotiating')`);
  else if (f.vista === "clientes") conds.push(eq(contacts.status, "client"));
  else if (f.vista === "novos") conds.push(sql`${contacts.createdAt} > now() - interval '30 days'`);
  else if (f.vista === "parados") {
    // Sem nenhuma interacção nos últimos 30 dias (e criados há mais de 30 dias)
    conds.push(
      sql`${contacts.createdAt} <= now() - interval '30 days' and not exists (select 1 from interactions i where i.contact_id = ${contacts.id} and i.created_at > now() - interval '30 days')`
    );
  }
  if (f.pais === "nenhum") conds.push(isNull(contacts.country));
  else if (f.pais && /^[A-Z]{2}$/.test(f.pais)) conds.push(eq(contacts.country, f.pais));
  if (f.canal === "nenhum") conds.push(isNull(contacts.channelId));
  else if (Number(f.canal) > 0) conds.push(eq(contacts.channelId, Number(f.canal)));
  const ids = (f.ids ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length) conds.push(inArray(contacts.id, ids));
  const defined = conds.filter(Boolean) as SQL[];
  return defined.length ? and(...defined) : undefined;
}

export const contactOrder = (sort?: string) => (SORTS[sort ?? ""] ?? SORTS.recent).order;
