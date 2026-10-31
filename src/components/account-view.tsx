import { CalendarClock, Fingerprint, Hash, KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { passkeys, type User } from "@/db/schema";
import { Panel } from "@/components/admin-ui";
import { PasskeyManager, PasswordChangeForm, ProfileForm } from "@/components/account-client";
import { passkeyLoginEnabled } from "@/lib/actions-account";
import { fmtDateTime } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = { admin: "Super Admin", staff: "Equipa", student: "Aluna" };

/** Página "Minha conta" partilhada entre o backoffice e a área de aluna. */
export async function AccountView({ user }: { user: User }) {
  const [keys, enabled] = await Promise.all([
    db.select().from(passkeys).where(eq(passkeys.userId, user.id)).orderBy(desc(passkeys.createdAt)),
    passkeyLoginEnabled(),
  ]);

  const info = [
    { icon: ShieldCheck, label: "Perfil de acesso", value: ROLE_LABEL[user.role] ?? user.role },
    { icon: CalendarClock, label: "Conta criada", value: fmtDateTime(user.createdAt) },
    { icon: LogIn, label: "Última entrada", value: user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "—" },
    { icon: KeyRound, label: "Palavra-passe alterada", value: user.passwordChangedAt ? fmtDateTime(user.passwordChangedAt) : "Nunca" },
    { icon: Fingerprint, label: "Face ID", value: keys.length ? `Ativo em ${keys.length} aparelho${keys.length > 1 ? "s" : ""}` : "Não ativado" },
    { icon: Hash, label: "N.º da conta", value: `#${user.id}` },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Face ID e chaves de acesso" description="Entre na plataforma com o rosto ou a impressão digital.">
          <PasskeyManager
            enabled={enabled}
            keys={keys.map((k) => ({
              id: k.id,
              name: k.name,
              deviceType: k.deviceType,
              backedUp: k.backedUp,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </Panel>
        <Panel>
          <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} />
        </Panel>
        <Panel>
          <PasswordChangeForm />
        </Panel>
      </div>

      <Panel title="Informações da conta" className="h-fit xl:sticky xl:top-6">
        <dl className="space-y-1">
          {info.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                <Icon size={15} />
              </span>
              <dt className="flex-1 text-xs text-zinc-500">{label}</dt>
              <dd className="text-right text-sm font-semibold text-zinc-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
