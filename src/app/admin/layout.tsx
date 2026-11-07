import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { and, count, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, formSubmissions, whatsappMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

// Adicionado ao ecrã inicial, o backoffice abre em ecrã inteiro como uma app
export const metadata: Metadata = {
  manifest: "/crm.webmanifest",
  appleWebApp: { capable: true, title: "Marina CRM", statusBarStyle: "default" },
  icons: { apple: "/img/app-icon-180.png" },
};

export const viewport: Viewport = {
  themeColor: "#f6f5f2",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  // Contadores da barra lateral: mensagens por ler e sessões de hoje
  const [[{ unread }], [{ today }], [{ forms }], store] = await Promise.all([
    db
      .select({ unread: count() })
      .from(whatsappMessages)
      .where(and(eq(whatsappMessages.direction, "in"), isNull(whatsappMessages.readAt))),
    db
      .select({ today: count() })
      .from(appointments)
      .where(and(gte(appointments.startAt, dayStart), lt(appointments.startAt, dayEnd), ne(appointments.status, "cancelled"))),
    // Antes do db:deploy a tabela ainda não existe: o backoffice não pode cair por causa de um contador
    db
      .select({ forms: count() })
      .from(formSubmissions)
      .where(eq(formSubmissions.status, "new"))
      .catch(() => [{ forms: 0 }]),
    cookies(),
  ]);

  return (
    <AdminShell
      user={{ name: user.name, role: user.role }}
      counts={{ whatsapp: unread, today, forms }}
      initialCollapsed={store.get("ml_sidebar")?.value === "1"}
    >
      {children}
    </AdminShell>
  );
}
