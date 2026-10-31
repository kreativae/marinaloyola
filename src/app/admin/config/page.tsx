import Link from "next/link";
import {
  CalendarDays,
  CalendarSync,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Mail,
  MessageCircle,
  Settings2,
  ShieldCheck,
  Tag,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { channels, contacts, contactTags, passkeys, payments, tags, users } from "@/db/schema";
import { PageHeader, Panel } from "@/components/admin-ui";
import { CopyButton } from "@/components/admin-client";
import { RegenerateFeedButton, ServiceForm } from "@/components/config-client";
import { ChannelManager } from "@/components/contacts-client";
import { TagManager, UserManager } from "@/components/team-client";
import { PasskeyAdmin, RevokeSessionsButton, SecurityForm } from "@/components/account-client";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { SESSION_DAYS } from "@/lib/login-guard";
import { getEvolutionConfig, webhookUrl } from "@/lib/evolution";
import { SERVICES, getService, type ServiceId } from "@/lib/services-def";
import { serviceFormState, serviceStatuses, type ServiceStatus } from "@/lib/services";
import { appUrl, getToken, readRaw } from "@/lib/settings";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONS: Record<ServiceId, LucideIcon> = {
  geral: Settings2,
  email: Mail,
  whatsapp: MessageCircle,
  zoom: Video,
  calendar: CalendarSync,
  hotmart: CreditCard,
  agendamento: CalendarDays,
};

const TONE: Record<ServiceStatus["tone"], string> = {
  ok: "bg-emerald-500",
  partial: "bg-amber-500",
  off: "bg-zinc-300",
};

const ROLES: Record<string, { label: string; className: string }> = {
  admin: { label: "Super Admin", className: "bg-plum/20 text-plum border-plum/40" },
  staff: { label: "Equipa", className: "bg-sky-500/10 text-sky-700 border-sky-500/30" },
  student: { label: "Aluna", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
};

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const tab = s === "equipa" || s === "seguranca" ? s : (getService(s ?? "")?.id ?? "geral");
  const statuses = await serviceStatuses();

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Cada serviço da plataforma: credenciais, comportamento e teste de ligação."
      />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="card h-fit p-2 lg:sticky lg:top-6" aria-label="Serviços">
          {SERVICES.map((svc) => {
            const Icon = ICONS[svc.id];
            const st = statuses[svc.id];
            const active = tab === svc.id;
            return (
              <Link
                key={svc.id}
                href={`/admin/config?s=${svc.id}`}
                scroll={false}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active ? "bg-plum/[0.08]" : "hover:bg-zinc-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-plum text-white" : "bg-zinc-100 text-zinc-500 group-hover:text-plum"
                  )}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-semibold", active ? "text-plum" : "text-zinc-900")}>
                    {svc.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className={cn("h-1.5 w-1.5 rounded-full", TONE[st.tone])} />
                    {st.label}
                  </span>
                </span>
                <ChevronRight size={14} className={cn("shrink-0 transition-transform", active ? "text-plum" : "text-zinc-300 group-hover:translate-x-0.5")} />
              </Link>
            );
          })}
          <div className="mx-3 my-2 border-t border-zinc-200" />
          <Link
            href="/admin/config?s=equipa"
            scroll={false}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              tab === "equipa" ? "bg-plum/[0.08]" : "hover:bg-zinc-50"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                tab === "equipa" ? "bg-plum text-white" : "bg-zinc-100 text-zinc-500 group-hover:text-plum"
              )}
            >
              <Users size={16} />
            </span>
            <span className={cn("flex-1 text-sm font-semibold", tab === "equipa" ? "text-plum" : "text-zinc-900")}>
              Equipa, tags & canais
            </span>
          </Link>
          <Link
            href="/admin/config?s=seguranca"
            scroll={false}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              tab === "seguranca" ? "bg-plum/[0.08]" : "hover:bg-zinc-50"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                tab === "seguranca" ? "bg-plum text-white" : "bg-zinc-100 text-zinc-500 group-hover:text-plum"
              )}
            >
              <ShieldCheck size={16} />
            </span>
            <span className={cn("flex-1 text-sm font-semibold", tab === "seguranca" ? "text-plum" : "text-zinc-900")}>
              Segurança e Face ID
            </span>
          </Link>
        </nav>

        {/* key: cada separador entra com a animação de página */}
        <div key={tab} className="min-w-0 animate-page-in">
          {tab === "equipa" ? <TeamTab /> : tab === "seguranca" ? <SecurityTab /> : <ServiceTab id={tab} status={statuses[tab]} />}
        </div>
      </div>
    </>
  );
}

async function ServiceTab({ id, status }: { id: ServiceId; status: ServiceStatus }) {
  const service = getService(id)!;
  const Icon = ICONS[id];
  const { values, secrets } = await serviceFormState(id);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-6 flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-plum/10 text-plum">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl text-zinc-950">{service.name}</h2>
              <span
                className={cn(
                  "chip",
                  status.tone === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : status.tone === "partial"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      : "border-zinc-200 bg-zinc-100 text-zinc-500"
                )}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{service.summary}</p>
          </div>
        </div>
        <ServiceForm service={service} values={values} secrets={secrets} />
      </div>
      <ServiceExtras id={id} />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      {children}
    </div>
  );
}

function UrlBox({ url, extra }: { url: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
        {url}
      </code>
      <CopyButton text={url} label="Copiar" />
      {extra}
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-600 marker:font-semibold marker:text-plum">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

async function ServiceExtras({ id }: { id: ServiceId }) {
  const base = await appUrl();
  const localNote = /localhost|127\.0\.0\.1/.test(base) && (
    <p className="mt-3 text-xs text-amber-700">
      O URL público ainda é {base}: serviços externos não o conseguem alcançar. Defina-o em Geral & marca.
    </p>
  );

  if (id === "whatsapp") {
    const evo = await getEvolutionConfig();
    return (
      <Panel title="Ligação">
        <div className="space-y-4">
          <InfoRow label="Webhook (configurado automaticamente ao ligar)">
            <UrlBox url={webhookUrl(evo)} />
            {localNote}
          </InfoRow>
          <Steps
            items={[
              "Preencha o URL e a API key do servidor Evolution e guarde.",
              "Use “Testar ligação” para confirmar que o servidor responde.",
              <>
                Abra a página{" "}
                <Link href="/admin/whatsapp" className="font-semibold text-plum hover:underline">
                  WhatsApp
                </Link>{" "}
                e leia o QR code com o telemóvel (Aparelhos ligados).
              </>,
            ]}
          />
        </div>
      </Panel>
    );
  }

  if (id === "hotmart") {
    const [raw, [{ n }]] = await Promise.all([
      readRaw(["hotmart_last_event"]),
      db.select({ n: count() }).from(payments).where(eq(payments.method, "hotmart")),
    ]);
    let last: { at: string; event: string; product: string; email: string } | null = null;
    try {
      last = raw.hotmart_last_event ? JSON.parse(raw.hotmart_last_event) : null;
    } catch {
      last = null;
    }
    return (
      <Panel title="Webhook">
        <div className="space-y-4">
          <InfoRow label="URL do webhook">
            <UrlBox url={`${base}/api/webhooks/hotmart`} />
            {localNote}
          </InfoRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoRow label="Último evento recebido">
              {last ? (
                <p className="text-sm text-zinc-700">
                  <span className="font-semibold">{last.event}</span> · {last.product}
                  <span className="block text-xs text-zinc-500">
                    {last.email} · {fmtDateTime(new Date(last.at))}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-zinc-500">Nenhum evento recebido ainda.</p>
              )}
            </InfoRow>
            <InfoRow label="Pagamentos Hotmart registados">
              <p className="text-2xl font-bold tabular-nums text-zinc-950">{n}</p>
            </InfoRow>
          </div>
          <Steps
            items={[
              "Hotmart → Ferramentas → Webhooks → Cadastrar webhook.",
              "Cole o URL acima e escolha a versão 2.0.0.",
              "Marque os eventos de compra (aprovada, completa, cancelada, reembolsada, atrasada, chargeback).",
              "Copie o Hottok mostrado pela Hotmart para o campo acima e guarde.",
            ]}
          />
        </div>
      </Panel>
    );
  }

  if (id === "calendar") {
    const token = await getToken("calendar_feed_token");
    const feed = `${base}/api/calendar/${token}.ics`;
    return (
      <Panel title="Os seus agendamentos no Google Calendar">
        <div className="space-y-4">
          <InfoRow label="Endereço do calendário (privado)">
            <UrlBox url={feed} extra={<RegenerateFeedButton />} />
            {localNote}
          </InfoRow>
          <Steps
            items={[
              "Google Calendar → Outros calendários → + → A partir do URL.",
              "Cole o endereço acima. Os agendamentos aparecem e são actualizados automaticamente (o Google actualiza a cada poucas horas).",
              "Para o sentido inverso, cole acima o endereço secreto iCal do seu calendário: os eventos ocupados bloqueiam os horários na página de marcação.",
            ]}
          />
          <p className="text-xs text-zinc-500">
            Não partilhe este endereço: quem o tiver vê os nomes e contactos das marcações.
          </p>
        </div>
      </Panel>
    );
  }

  if (id === "zoom") {
    return (
      <Panel title="Criar a app no Zoom">
        <Steps
          items={[
            <>
              Entre em{" "}
              <a href="https://marketplace.zoom.us/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-plum hover:underline">
                marketplace.zoom.us <ExternalLink size={11} />
              </a>{" "}
              → Develop → Build App → Server-to-Server OAuth.
            </>,
            "Em Scopes, adicione meeting:write:meeting:admin e user:read:user:admin.",
            "Active a app e copie Account ID, Client ID e Client secret para os campos acima.",
            "Escolha o modo “Criar uma reunião Zoom por agendamento” e use “Testar credenciais”.",
          ]}
        />
      </Panel>
    );
  }

  if (id === "email") {
    return (
      <Panel title="Ligar o Resend">
        <Steps
          items={[
            "Crie uma conta em resend.com e adicione o domínio marinaloyola.com (registos DNS SPF e DKIM).",
            "Crie uma API key com permissão de envio e cole-a acima.",
            "O remetente tem de usar o domínio verificado, ex: Marina Loyola <ola@marinaloyola.com>.",
            "Use “Enviar email de teste”: chega ao email que recebe os avisos.",
          ]}
        />
      </Panel>
    );
  }

  if (id === "agendamento") {
    return (
      <Panel title="Horários e tipos de sessão">
        <p className="text-sm leading-relaxed text-zinc-600">
          A disponibilidade semanal e os tipos de sessão (nome, duração) gerem-se na{" "}
          <Link href="/admin/agenda" className="font-semibold text-plum hover:underline">
            Agenda
          </Link>
          . As regras acima aplicam-se a todos os tipos de sessão.
        </p>
      </Panel>
    );
  }

  return null;
}

async function TeamTab() {
  const [me, tagRows, allUsers, channelRows] = await Promise.all([
    getSessionUser(),
    db
      .select({ id: tags.id, name: tags.name, color: tags.color, count: count(contactTags.contactId) })
      .from(tags)
      .leftJoin(contactTags, eq(contactTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(asc(tags.name)),
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .orderBy(asc(sql`case ${users.role} when 'admin' then 0 when 'staff' then 1 else 2 end`), desc(users.createdAt)),
    db
      .select({ id: channels.id, name: channels.name, color: channels.color, count: count(contacts.id) })
      .from(channels)
      .leftJoin(contacts, eq(contacts.channelId, channels.id))
      .groupBy(channels.id)
      .orderBy(asc(channels.name)),
  ]);
  const canManage = me?.role === "admin";
  return (
    <div className="space-y-6">
      <div id="utilizadores" className="scroll-mt-6">
        <Panel title={`Utilizadores da plataforma (${allUsers.length})`}>
          <UserManager
            users={allUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
            meId={me?.id ?? 0}
            canManage={canManage}
          />
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Contas de alunas também são criadas automaticamente ao dar acesso a um curso ou por compra via Hotmart.
          </p>
        </Panel>
      </div>

      <div id="tags" className="scroll-mt-6">
        <Panel title={`Tags de segmentação (${tagRows.length})`}>
          <p className="mb-4 text-xs leading-relaxed text-zinc-500">
            Etiquetas para segmentar contactos. Também são criadas pelas integrações (Hotmart, WhatsApp, agendamentos).
            Clique no nome para renomear, na cor para mudar e no número para ver os contactos.
          </p>
          <TagManager tags={tagRows} canManage={canManage} />
        </Panel>
      </div>

      <div id="canais" className="scroll-mt-6">
        <Panel title={`Canais de origem (${channelRows.length})`}>
          <p className="mb-4 text-xs leading-relaxed text-zinc-500">
            Redes e grupos de onde vêm os contactos — BNI, CNN, BNEX, eventos, parceiros… Escolhem-se no formulário
            do contacto e aparecem nos filtros e no resumo dos Contactos.
          </p>
          <ChannelManager channels={channelRows} />
        </Panel>
      </div>
    </div>
  );
}

async function SecurityTab() {
  const [me, raw, keyRows, recent, h] = await Promise.all([
    getSessionUser(),
    readRaw(["session_days", "login_lockout", "passkey_login", "session_epoch"]),
    db
      .select({ key: passkeys, owner: users.name })
      .from(passkeys)
      .innerJoin(users, eq(users.id, passkeys.userId))
      .orderBy(asc(users.name), desc(passkeys.createdAt)),
    db
      .select({ id: users.id, name: users.name, role: users.role, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(sql`${users.lastLoginAt} is not null`)
      .orderBy(desc(users.lastLoginAt))
      .limit(8),
    headers(),
  ]);
  const canManage = me?.role === "admin";
  const days = Number(raw.session_days);
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const hostname = host.split(":")[0];
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const https = (h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https")) === "https";
  const epoch = Number(raw.session_epoch) || 0;

  const checks = [
    {
      ok: https || local,
      label: https ? "Ligação segura (https)" : local ? "Ambiente local" : "Sem https",
      text: "O Face ID só funciona em endereços https. Já está tratado pelo Coolify.",
    },
    {
      ok: true,
      label: `Domínio do Face ID: ${hostname || "—"}`,
      text: "As chaves ficam associadas a este domínio. Se a plataforma mudar de endereço, cada pessoa ativa o Face ID outra vez.",
    },
    {
      ok: true,
      label: "Sem chaves nem APIs externas",
      text: "O Face ID usa o padrão WebAuthn do próprio navegador (Apple, Google, Microsoft). Não há custos nem contas a criar.",
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Como está protegida a plataforma">
        <ul className="space-y-3">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-3">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", c.ok ? "bg-emerald-500" : "bg-amber-500")} />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">{c.label}</span>
                <span className="block text-xs leading-relaxed text-zinc-500">{c.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Regras de acesso">
        <SecurityForm
          canManage={canManage}
          sessionDays={(SESSION_DAYS as readonly number[]).includes(days) ? days : 30}
          lockout={raw.login_lockout !== "0"}
          passkeyLogin={raw.passkey_login !== "0"}
        />
        {!canManage && <p className="mt-4 text-[11px] text-zinc-500">Só a Super Admin pode alterar estas definições.</p>}
      </Panel>

      <div id="face-id" className="scroll-mt-6">
        <Panel title={`Aparelhos com Face ID (${keyRows.length})`}>
          <p className="mb-4 text-xs leading-relaxed text-zinc-500">
            Cada pessoa ativa o Face ID no próprio aparelho, em “Minha conta”. Remova aqui um telemóvel perdido ou de alguém
            que saiu da equipa.
          </p>
          <PasskeyAdmin
            canManage={canManage}
            keys={keyRows.map(({ key: k, owner }) => ({
              id: k.id,
              name: k.name,
              owner,
              deviceType: k.deviceType,
              backedUp: k.backedUp,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Últimos acessos">
          {recent.length === 0 ? (
            <p className="text-xs text-zinc-500">Ainda sem registos de entrada.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{u.name}</span>
                    <span className="text-[11px] text-zinc-500">{ROLES[u.role]?.label ?? u.role}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">{fmtDateTime(u.lastLoginAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sessões abertas">
          <p className="mb-4 text-xs leading-relaxed text-zinc-500">
            Se suspeitar que alguém entrou sem autorização, ou depois de alterar acessos da equipa, termine todas as sessões:
            todas as pessoas terão de entrar outra vez, em todos os aparelhos.
            {epoch > 0 && <> Última vez: {fmtDateTime(new Date(epoch))}.</>}
          </p>
          {canManage ? <RevokeSessionsButton /> : <p className="text-[11px] text-zinc-500">Só a Super Admin pode fazer isto.</p>}
        </Panel>
      </div>
    </div>
  );
}
