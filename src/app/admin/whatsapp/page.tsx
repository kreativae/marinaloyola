import Link from "next/link";
import { ChevronLeft, MessageCircle, Settings2, UserRound } from "lucide-react";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, whatsappMessages } from "@/db/schema";
import {
  connectionState,
  formatPhone,
  getEvolutionConfig,
  isConfigured,
  normalizePhone,
  type ConnectionState,
} from "@/lib/evolution";
import { PageHeader } from "@/components/admin-ui";
import { LocalTime } from "@/components/local-time";
import {
  AutoRefresh,
  ContactNameEditor,
  DeleteConversationButton,
  MessageBubble,
  ReplyBox,
  ScrollToBottom,
  WhatsappConnection,
} from "@/components/whatsapp-client";
import { getSessionUser } from "@/lib/auth";
import { ConversationList, type InboxConversation } from "@/components/whatsapp-inbox";
import { avatarTone } from "@/lib/whatsapp-def";
import { cn, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Conversation = {
  id: number;
  name: string;
  phone: string | null;
  body: string;
  kind: string;
  media_name: string | null;
  direction: string;
  at: Date;
  unread: number;
};

/** O WhatsApp só deixa apagar para todos durante cerca de 2 dias. */
const isRecent = (d: Date) => Date.now() - d.getTime() < 2 * 86400000;

export default async function WhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const selectedId = Number(c) || null;
  const [config, me] = await Promise.all([getEvolutionConfig(), getSessionUser()]);
  const configured = isConfigured(config);
  let state: ConnectionState = "unknown";
  if (configured) state = await connectionState(config).catch(() => "unknown" as const);

  if (selectedId) {
    await db
      .update(whatsappMessages)
      .set({ readAt: new Date() })
      .where(and(eq(whatsappMessages.contactId, selectedId), isNull(whatsappMessages.readAt)));
  }

  const [convRows, selected, messages, withPhone] = await Promise.all([
    db.execute(sql`
      SELECT c.id, c.name, c.phone, m.body, m.kind, m.media_name, m.direction, m.created_at AS at,
        (SELECT COUNT(*)::int FROM whatsapp_messages u
          WHERE u.contact_id = c.id AND u.read_at IS NULL AND u.direction = 'in') AS unread
      FROM contacts c
      JOIN LATERAL (
        SELECT body, kind, media_name, direction, created_at FROM whatsapp_messages
        WHERE contact_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1
      ) m ON true
      ORDER BY m.created_at DESC
      LIMIT 100`),
    selectedId
      ? db.select().from(contacts).where(eq(contacts.id, selectedId)).limit(1).then((r) => r[0])
      : null,
    selectedId
      ? db
          .select()
          .from(whatsappMessages)
          .where(eq(whatsappMessages.contactId, selectedId))
          .orderBy(asc(whatsappMessages.createdAt), asc(whatsappMessages.id))
          .limit(300)
      : [],
    db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(isNotNull(contacts.phone))
      .orderBy(asc(contacts.name)),
  ]);
  const conversations: InboxConversation[] = (convRows.rows as unknown as Conversation[]).map((r) => ({
    ...r,
    at: new Date(r.at).toISOString(),
  }));
  const selectedPhone = normalizePhone(selected?.phone);
  const thread = groupByDay(messages);

  return (
    <>
      <AutoRefresh />
      <div className={cn(selected && "max-xl:hidden")}>
        <PageHeader
          title="WhatsApp"
          subtitle="Conversas da Evolution API ligadas ao CRM: cada número novo que escreve entra como lead."
          actions={
            <>
              <WhatsappConnection initialState={state} configured={configured} />
              {me?.role === "admin" && (
                <Link
                  href="/admin/config?s=whatsapp"
                  title={configured ? "URL, API key, instância e mensagens automáticas" : "Ainda não configurado: comece aqui"}
                  className="btn-ghost !px-4 !py-2.5 !text-xs"
                >
                  <Settings2 size={14} /> Definições
                </Link>
              )}
            </>
          }
        />
      </div>

      <div className="card grid overflow-hidden max-xl:rounded-[20px] xl:h-[max(560px,calc(100dvh-15.5rem))] xl:grid-cols-[minmax(300px,360px)_1fr]">
        {/* ----------------------- conversas ----------------------- */}
        <div className={cn("flex min-h-0 flex-col xl:border-r xl:border-line", selected && "max-xl:hidden")}>
          <ConversationList conversations={conversations} contacts={withPhone} selectedId={selectedId} />
        </div>

        {/* ------------------------ conversa ------------------------ */}
        {selected ? (
          <div className="wa-thread flex min-h-0 flex-col bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] xl:gap-3 xl:px-5 xl:py-3">
              <div className="flex min-w-0 items-center gap-2 xl:gap-3">
                <Link href="/admin/whatsapp" aria-label="Voltar às conversas" className="tap flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-700 xl:hidden">
                  <ChevronLeft size={24} />
                </Link>
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", avatarTone(selected.name))}>
                  {initials(selected.name)}
                </span>
                <div className="min-w-0">
                  <ContactNameEditor key={selected.name} contactId={selected.id} name={selected.name} />
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    <span className="tabular-nums">{selectedPhone ? formatPhone(selectedPhone) : "Sem número válido"}</span>
                    {selected.timezone && (
                      <>
                        <span className="text-zinc-300 max-sm:hidden">·</span>
                        <LocalTime timezone={selected.timezone} country={selected.country} className="text-[11px] text-zinc-500 max-sm:hidden" />
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/admin/crm/${selected.id}`}
                  aria-label="Ficha no CRM"
                  className="tap inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 transition-colors hover:border-plum/40 hover:text-plum max-xl:w-10 xl:px-4"
                >
                  <UserRound size={15} />
                  <span className="hidden xl:inline">Ficha no CRM</span>
                </Link>
                {messages.length > 0 && (
                  <DeleteConversationButton
                    contactId={selected.id}
                    name={selected.name}
                    count={messages.length < 300 ? messages.length : undefined}
                    redirectTo="/admin/whatsapp"
                    compact
                  />
                )}
              </div>
            </div>

            <div className="wa-wall flex-1 overflow-y-auto overscroll-contain px-3 pb-4 xl:px-8">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <span className={cn("flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold", avatarTone(selected.name))}>{initials(selected.name)}</span>
                  <p className="mt-4 font-display text-xl text-zinc-950">Comece a conversa</p>
                  <p className="mt-1 text-sm text-zinc-500">Escreva abaixo para enviar a primeira mensagem a {selected.name.split(" ")[0]}.</p>
                </div>
              )}
              {thread.map((day) => (
                <section key={day.key}>
                  <div className="sticky top-0 z-10 flex justify-center pb-1 pt-3">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-zinc-500 shadow-[0_1px_2px_rgb(24_24_27/0.08)] ring-1 ring-zinc-200/60 backdrop-blur">
                      {day.label}
                    </span>
                  </div>
                  {day.items.map(({ m, grouped, tail }) => (
                    <MessageBubble
                      key={m.id}
                      grouped={grouped}
                      tail={tail}
                      m={{
                        id: m.id,
                        direction: m.direction,
                        body: m.body,
                        kind: m.kind,
                        mediaMime: m.mediaMime,
                        mediaName: m.mediaName,
                        mediaSize: m.mediaSize,
                        mediaSeconds: m.mediaSeconds,
                        downloaded: !!m.mediaFile,
                        canFetch: !!m.waRaw,
                        deletable: m.direction === "out" && !!m.waMessageId && isRecent(m.createdAt),
                        at: m.createdAt.toISOString(),
                      }}
                    />
                  ))}
                </section>
              ))}
              <ScrollToBottom dep={messages.length} />
            </div>

            <ReplyBox contactId={selected.id} disabled={state !== "open" || !selectedPhone} />
          </div>
        ) : (
          <div className="wa-wall hidden flex-col items-center justify-center p-8 text-center xl:flex">
            <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-plum shadow-[0_12px_30px_-12px_rgb(128_0_128/0.35)] ring-1 ring-plum/10">
              <MessageCircle size={26} />
            </span>
            <p className="mt-5 font-display text-2xl text-zinc-950">Escolha uma conversa</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
              Selecione uma conversa à esquerda ou carregue em <strong className="font-semibold text-plum">Nova</strong> para escrever a um contacto do CRM.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

type Msg = typeof whatsappMessages.$inferSelect;

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });

/** Separa a conversa por dias e junta as mensagens seguidas da mesma pessoa. */
function groupByDay(messages: Msg[]) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const days: { key: string; label: string; items: { m: Msg; grouped: boolean; tail: boolean }[] }[] = [];
  messages.forEach((m, i) => {
    const key = dayKey(m.createdAt);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      const sameYear = key.slice(0, 4) === today.slice(0, 4);
      const label =
        key === today
          ? "Hoje"
          : key === yesterday
            ? "Ontem"
            : m.createdAt.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
      day = { key, label, items: [] };
      days.push(day);
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const near = (a?: Msg, b?: Msg) =>
      !!a && !!b && a.direction === b.direction && dayKey(a.createdAt) === dayKey(b.createdAt) && Math.abs(b.createdAt.getTime() - a.createdAt.getTime()) < 5 * 60_000;
    day.items.push({ m, grouped: day.items.length > 0 && near(prev, m), tail: !near(m, next) });
  });
  return days;
}
