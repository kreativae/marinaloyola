import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { addInteraction, findOrCreateContact, tagContact } from "@/lib/crm";
import { getSettings, isOn, saveSettings } from "@/lib/settings";
import { eur } from "@/lib/utils";
import { safeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Webhook da Hotmart — configuração:
 * Painel Hotmart → Ferramentas → Webhooks → adicionar <URL pública>/api/webhooks/hotmart
 * (o endereço exacto aparece em Configurações → Hotmart).
 * Eventos cobertos: PURCHASE_APPROVED / COMPLETED / CANCELED / REFUNDED / DELAYED / DISPUTE
 */
const STATUS_MAP: Record<string, "pending" | "confirmed" | "completed" | "refunded" | "cancelled"> = {
  approved: "confirmed",
  completed: "completed",
  refunded: "refunded",
  canceled: "cancelled",
  cancelled: "cancelled",
  delayed: "pending",
  waiting_payment: "pending",
  dispute: "pending",
  expired: "cancelled",
};

export async function POST(req: Request) {
  // Hottok: Configurações → Hotmart (ou HOTMART_HOTTOK)
  const cfg = await getSettings(["hotmart_hottok", "hotmart_tags"]);
  // Sem hottok configurado não se aceita nada: qualquer pessoa podia criar pagamentos falsos
  const hottok = cfg.hotmart_hottok;
  if (!safeEqual(req.headers.get("x-hotmart-hottok"), hottok)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const event = String(body.event ?? "").toLowerCase();
  const data = (body.data ?? {}) as Record<string, never>;
  const buyer = (data.buyer ?? {}) as { name?: string; email?: string; phone?: string };
  const purchase = (data.purchase ?? {}) as {
    status?: string;
    transaction?: string;
    price?: { value?: number };
    full_price?: { value?: number };
    offer?: { name?: string };
  };
  const product = (data.product ?? {}) as { name?: string };

  const email = String(buyer.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "missing buyer email" }, { status: 400 });
  }

  const purchaseStatus = String(purchase.status ?? "").toLowerCase();
  const status =
    STATUS_MAP[purchaseStatus] ??
    (event.includes("approved") || event.includes("completed")
      ? "confirmed"
      : event.includes("refund") || event.includes("chargeback")
        ? "refunded"
        : event.includes("cancel")
          ? "cancelled"
          : "pending");
  const amount = Number(purchase.price?.value ?? purchase.full_price?.value ?? 0);
  const productName = product.name ?? purchase.offer?.name ?? "Produto Hotmart";
  const name = buyer.name ?? email.split("@")[0];

  const { contact } = await findOrCreateContact({
    name,
    email,
    phone: buyer.phone ?? null,
    source: "hotmart",
  });

  if (!isOn(cfg.hotmart_tags)) {
    // etiquetas automáticas desligadas em Configurações
  } else if (status === "confirmed" || status === "completed") {
    await tagContact(contact.id, `Comprador ${productName}`, "#a855f7");
    await tagContact(contact.id, "Cliente Hotmart", "#f97316");
  } else {
    await tagContact(contact.id, "Lead Hotmart", "#f97316");
  }

  // A Hotmart envia vários eventos para a mesma transação: actualiza em vez de duplicar.
  const reference = purchase.transaction ?? null;
  const [existing] = reference
    ? await db.select().from(payments).where(eq(payments.reference, reference)).limit(1)
    : [];
  if (existing) {
    const paid = status === "confirmed" || status === "completed";
    await db
      .update(payments)
      .set({ status, paidAt: paid ? (existing.paidAt ?? new Date()) : null })
      .where(eq(payments.id, existing.id));
  } else {
    await db.insert(payments).values({
      contactId: contact.id,
      product: productName,
      amount: String(amount.toFixed(2)),
      method: "hotmart",
      status,
      reference,
      paidAt: status === "confirmed" || status === "completed" ? new Date() : null,
    });
  }

  await addInteraction(
    contact.id,
    "purchase",
    `Hotmart [${event || purchaseStatus}]: ${productName} — ${eur(amount)} → ${status}. Contacto importado/actualizado automaticamente.`
  );

  await saveSettings({
    hotmart_last_event: JSON.stringify({
      at: new Date().toISOString(),
      event: event || purchaseStatus,
      product: productName,
      email,
    }),
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "hotmart-webhook", accept: "POST" });
}
