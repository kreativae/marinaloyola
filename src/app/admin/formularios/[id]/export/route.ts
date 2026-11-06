import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { formSubmissions, forms } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { SUBMISSION_STATUS, slugify } from "@/lib/forms-def";
import { csvCell } from "@/lib/security";
import { HOME_TZ } from "@/lib/timezones";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role === "student") return new Response("Não autorizado", { status: 401 });
  const id = Number((await params).id);
  const [form] = Number.isInteger(id) ? await db.select().from(forms).where(eq(forms.id, id)).limit(1) : [];
  if (!form) return new Response("Não encontrado", { status: 404 });
  const rows = await db.select().from(formSubmissions).where(eq(formSubmissions.formId, id)).orderBy(desc(formSubmissions.createdAt));

  // Colunas: os campos atuais e, a seguir, os que já foram removidos mas têm respostas
  const columns = new Map(form.fields.map((f) => [f.id, f.label]));
  for (const r of rows) for (const a of r.answers) if (!columns.has(a.id)) columns.set(a.id, a.label);
  const ids = [...columns.keys()];

  const header = ["Data", "Estado", "Origem", ...columns.values()].map(csvCell);
  const lines = rows.map((r) => {
    const by = new Map(r.answers.map((a) => [a.id, a.value]));
    return [r.createdAt.toLocaleString("sv-SE", { timeZone: HOME_TZ }).slice(0, 16), SUBMISSION_STATUS[r.status] ?? r.status, r.origin, ...ids.map((i) => by.get(i))].map(csvCell).join(";");
  });
  // BOM + ";" para abrir directamente no Excel em português.
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="formulario-${slugify(form.name)}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
