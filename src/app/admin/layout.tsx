import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { and, count, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, whatsappMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  // Contadores da barra lateral: mensagens por ler e sessões de hoje
  const [[{ unread }], [{ today }], store] = await Promise.all([
    db
      .select({ unread: count() })
      .from(whatsappMessages)
      .where(and(eq(whatsappMessages.direction, "in"), isNull(whatsappMessages.readAt))),
    db
      .select({ today: count() })
      .from(appointments)
      .where(and(gte(appointments.startAt, dayStart), lt(appointments.startAt, dayEnd), ne(appointments.status, "cancelled"))),
    cookies(),
  ]);

  return (
    <AdminShell
      user={{ name: user.name, role: user.role }}
      counts={{ whatsapp: unread, today }}
      initialCollapsed={store.get("ml_sidebar")?.value === "1"}
    >
      {children}
    </AdminShell>
  );
}
