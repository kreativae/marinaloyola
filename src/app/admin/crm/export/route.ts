import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, contacts, contactTags, tags } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { contactOrder, contactWhere } from "@/lib/contacts-query";
import { countryName } from "@/lib/timezones";
import { CONTACT_STATUS, SOURCES } from "@/lib/utils";
import { csvCell } from "@/lib/security";

export const dynamic = "force-dynamic";

const cell = csvCell;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "student") {
    return new Response("Não autorizado", { status: 401 });
  }

  const [rows, tagRows, channelRows] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(contactWhere(Object.fromEntries(new URL(req.url).searchParams)))
      .orderBy(...contactOrder()),
    db
      .select({ contactId: contactTags.contactId, name: tags.name })
      .from(contactTags)
      .innerJoin(tags, eq(tags.id, contactTags.tagId)),
    db.select().from(channels),
  ]);
  const channelName = new Map(channelRows.map((c) => [c.id, c.name]));
  const tagsBy = new Map<number, string[]>();
  for (const t of tagRows) tagsBy.set(t.contactId, [...(tagsBy.get(t.contactId) ?? []), t.name]);

  const header = ["Nome", "Email", "Telefone", "Localização", "País", "Fuso", "Origem", "Canal", "Indicado por", "Estado", "Tags", "Notas", "Criado em"];
  const lines = rows.map((c) =>
    [
      c.name,
      c.email,
      c.phone,
      c.location,
      c.country ? countryName(c.country) : "",
      c.timezone,
      SOURCES[c.source] ?? c.source,
      c.channelId ? channelName.get(c.channelId) : "",
      c.referredBy,
      CONTACT_STATUS[c.status]?.label ?? c.status,
      (tagsBy.get(c.id) ?? []).join(", "),
      c.notes,
      c.createdAt.toISOString().slice(0, 10),
    ]
      .map(cell)
      .join(";")
  );
  // BOM + ";" para abrir directamente no Excel em português.
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contactos-${date}.csv"`,
    },
  });
}
