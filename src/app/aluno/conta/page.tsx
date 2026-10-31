import type { Metadata } from "next";
import { PageHeader } from "@/components/admin-ui";
import { AccountView } from "@/components/account-view";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta" };

export default async function AlunaContaPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Área de aluna" title="Minha conta" subtitle="Os seus dados, palavra-passe e entrada com Face ID." />
      <AccountView user={user} />
    </>
  );
}
