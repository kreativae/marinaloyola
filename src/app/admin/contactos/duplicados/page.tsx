import Link from "next/link";
import { ArrowLeft, Merge } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/admin-ui";
import { DuplicateGroupCard } from "@/components/duplicates-client";
import { DUPLICATE_REASONS } from "@/lib/contacts-def";
import { findDuplicateGroups } from "@/lib/contacts-merge";
import { CONTACT_STATUS, fmtDate, SOURCES } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DuplicadosPage() {
  const groups = await findDuplicateGroups();
  return (
    <>
      <Link
        href="/admin/contactos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-plum"
      >
        <ArrowLeft size={15} /> Voltar aos contactos
      </Link>
      <PageHeader
        title="Contactos duplicados"
        subtitle="Escolha a ficha que fica. O histórico, as conversas, os pagamentos e os agendamentos das outras passam para ela."
      />
      {groups.length === 0 ? (
        <EmptyState text="Não há possíveis duplicados." icon={<Merge size={18} />} />
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => (
            <DuplicateGroupCard
              key={g.key}
              groupKey={g.key}
              reasons={g.reasons.map((r) => DUPLICATE_REASONS[r])}
              members={g.members.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                phone: m.phone,
                source: SOURCES[m.source] ?? m.source,
                status: CONTACT_STATUS[m.status]?.label ?? m.status,
                when: fmtDate(m.createdAt),
              }))}
            />
          ))}
        </div>
      )}
    </>
  );
}
