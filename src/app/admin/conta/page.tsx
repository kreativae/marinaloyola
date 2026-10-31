import type { Metadata } from "next";
import { PageHeader } from "@/components/admin-ui";
import { AccountView } from "@/components/account-view";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta" };

export default async function MinhaContaPage() {
  const user = await requireAdmin();
  return (
    <>
      <PageHeader title="Minha conta" subtitle="Os seus dados, palavra-passe e entrada com Face ID." />
      <AccountView user={user} />
    </>
  );
}
