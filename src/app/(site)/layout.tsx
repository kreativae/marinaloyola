import type { ReactNode } from "react";
import { Footer, Header, WhatsAppFloat } from "@/components/site";
import { getSettings } from "@/lib/settings";
import { getSitePage } from "@/lib/site-content";

export const dynamic = "force-dynamic";

async function contacts() {
  try {
    const s = await getSettings(["whatsapp_number", "contact_email"]);
    return { whatsapp: s.whatsapp_number || "351912345678", email: s.contact_email || "ola@marinaloyola.com" };
  } catch {
    return { whatsapp: "351912345678", email: "ola@marinaloyola.com" };
  }
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [{ whatsapp, email }, { s }] = await Promise.all([contacts(), getSitePage("geral")]);
  const chrome = { ...s.header, ...s.footer };
  return (
    <>
      <Header whatsapp={whatsapp} chrome={chrome} />
      <main className="pt-[72px]">{children}</main>
      <Footer whatsapp={whatsapp} email={email} chrome={chrome} />
      {s.whatsapp.show === "1" && <WhatsAppFloat number={whatsapp} message={s.whatsapp.message} />}
    </>
  );
}
