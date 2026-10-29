import type { ReactNode } from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { Footer, Header, WhatsAppFloat } from "@/components/site";

export const dynamic = "force-dynamic";

async function getSetting(key: string, fallback: string) {
  try {
    const rows = await db.select().from(settings);
    return rows.find((r) => r.key === key)?.value || fallback;
  } catch {
    return fallback;
  }
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const whatsapp = await getSetting("whatsapp_number", "351912345678");
  const email = await getSetting("contact_email", "ola@marinaloyola.com");
  return (
    <>
      <Header whatsapp={whatsapp} />
      <main className="pt-[72px]">{children}</main>
      <Footer whatsapp={whatsapp} email={email} />
      <WhatsAppFloat number={whatsapp} />
    </>
  );
}
