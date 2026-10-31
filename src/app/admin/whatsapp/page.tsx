import Form from "next/form";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Settings2 } from "lucide-react";
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
  MessageBubble,
  ReplyBox,
  ScrollToBottom,
  WhatsappConnection,
} from "@/components/whatsapp-client";
import { waPreview } from "@/lib/whatsapp-def";
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

const timeLabel = (d: Date) => {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
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
  const config = await getEvolutionConfig();
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
  const conversations = (convRows.rows as unknown as Conversation[]).map((r) => ({
    ...r,
    at: new Date(r.at),
  }));
  const selectedPhone = normalizePhone(selected?.phone);

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="WhatsApp"
        subtitle="Conversas da Evolution API ligadas ao CRM: cada número novo que escreve entra como lead."
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        {/* ----------------------- coluna esquerda ----------------------- */}
        <div className="min-w-0 space-y-4">
          <WhatsappConnection initialState={state} configured={configured} />

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Conversas ({conversations.length})
              </p>
            </div>
            <Form action="/admin/whatsapp" className="flex gap-2 border-b border-zinc-200 p-3">
              <select name="c" defaultValue="" className="field !py-2 !text-xs" required>
                <option value="" disabled>
                  Nova conversa com um contacto…
                </option>
                {withPhone.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-dark !px-3.5 !py-2 !text-xs">
                Abrir
              </button>
            </Form>
            <ul className="max-h-[560px] divide-y divide-zinc-100 overflow-y-auto">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <Link
                    href={`/admin/whatsapp?c=${conv.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50",
                      conv.id === selectedId && "bg-plum/[0.06]"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                      {initials(conv.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-zinc-900">{conv.name}</span>
                        <span className={cn("shrink-0 text-[11px]", conv.unread ? "font-bold text-emerald-600" : "text-zinc-500")}>
                          {timeLabel(conv.at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-zinc-500">
                          {conv.direction === "out" && "Você: "}
                          {waPreview(conv.kind, conv.body, conv.media_name)}
                        </span>
                        {conv.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                            {conv.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {conversations.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-zinc-500">
                  Ainda sem conversas. As mensagens recebidas aparecem aqui.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* -------------------------- conversa --------------------------- */}
        <div className="min-w-0">
          {selected ? (
            <div className="flex h-[720px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-plum text-xs font-bold text-white">
                    {initials(selected.name)}
                  </span>
                  <div className="min-w-0">
                    <ContactNameEditor key={selected.name} contactId={selected.id} name={selected.name} />
                    <p className="text-xs text-zinc-500">
                      {selectedPhone ? formatPhone(selectedPhone) : "Sem número válido"}
                    </p>
                    {selected.timezone && (
                      <LocalTime timezone={selected.timezone} country={selected.country} className="mt-0.5 text-[11px] text-zinc-500" />
                    )}
                  </div>
                </div>
                <Link
                  href={`/admin/crm/${selected.id}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-plum hover:underline"
                >
                  Ficha no CRM <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 px-5 py-5">
                {messages.length === 0 && (
                  <p className="py-16 text-center text-sm text-zinc-500">
                    Sem mensagens. Escreva abaixo para iniciar a conversa.
                  </p>
                )}
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
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
                <ScrollToBottom dep={messages.length} />
              </div>

              <ReplyBox contactId={selected.id} disabled={state !== "open" || !selectedPhone} />
            </div>
          ) : (
            <div className="flex h-[720px] flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-plum/10 text-plum">
                <MessageCircle size={24} />
              </span>
              <p className="mt-4 font-display text-2xl text-zinc-950">Escolha uma conversa</p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500">
                Selecione uma conversa à esquerda ou abra uma nova com um contacto do CRM.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --------------------------- definições -------------------------- */}
      <Link
        href="/admin/config?s=whatsapp"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm transition-colors hover:border-plum/40"
      >
        <Settings2 size={16} className="text-plum" />
        <span className="flex-1">
          <span className="font-semibold text-zinc-900">Definições da Evolution API</span>
          <span className="ml-2 text-zinc-500">
            {configured ? "URL, API key, instância e mensagens automáticas" : "Ainda não configurado — comece aqui"}
          </span>
        </span>
        <ArrowUpRight size={15} className="text-zinc-400" />
      </Link>
    </>
  );
}
