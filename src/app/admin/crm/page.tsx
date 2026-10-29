import { redirect } from "next/navigation";

// A lista de contactos passou para /admin/contactos (as fichas continuam em /admin/crm/[id]).
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const qs = new URLSearchParams(await searchParams).toString();
  redirect(`/admin/contactos${qs ? `?${qs}` : ""}`);
}
