"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCheck, MessageCirclePlus, Search, X } from "lucide-react";
import { Modal } from "@/components/form-kit";
import { DeleteConversationButton } from "@/components/whatsapp-client";
import { avatarTone, waPreview } from "@/lib/whatsapp-def";
import { cn, initials } from "@/lib/utils";

export type InboxConversation = {
  id: number;
  name: string;
  phone: string | null;
  body: string;
  kind: string;
  media_name: string | null;
  direction: string;
  at: string;
  unread: number;
};

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Horas sempre de Lisboa, como nas mensagens: o servidor e o browser mostram o mesmo
const TZ = "Europe/Lisbon";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
function timeLabel(iso: string) {
  const d = new Date(iso);
  const days = Math.round((Date.parse(dayKey(new Date())) - Date.parse(dayKey(d))) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  if (days === 1) return "Ontem";
  if (days < 7) return d.toLocaleDateString("pt-PT", { weekday: "short", timeZone: TZ }).replace(".", "");
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", timeZone: TZ });
}

/** Coluna das conversas: procurar, abrir uma nova e ver o que está por ler. */
export function ConversationList({
  conversations,
  contacts,
  selectedId,
}: {
  conversations: InboxConversation[];
  contacts: { id: number; name: string }[];
  selectedId: number | null;
}) {
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState(false);
  const term = normalize(q.trim());
  const list = term
    ? conversations.filter((c) => normalize(`${c.name} ${c.phone ?? ""} ${c.body}`).includes(term))
    : conversations;
  const unread = conversations.filter((c) => c.unread > 0).length;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-xl text-zinc-950">Conversas</span>
            <span className="text-xs text-zinc-400">
              {conversations.length}
              {unread > 0 && <span className="ml-1.5 font-semibold text-emerald-600">· {unread} por ler</span>}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="tap flex h-9 items-center gap-1.5 rounded-full bg-plum px-3.5 text-xs font-semibold text-white shadow-[0_8px_20px_-10px_rgb(128_0_128/0.8)] transition-colors hover:bg-plum-ink"
          >
            <MessageCirclePlus size={15} /> Nova
          </button>
        </div>
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar conversa"
            className="h-10 w-full rounded-full border border-transparent bg-zinc-100/80 pl-10 pr-9 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-plum/30 focus:bg-white focus:ring-4 focus:ring-plum/10"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Limpar" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700">
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      <ul className="admin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {list.map((conv) => {
          const on = conv.id === selectedId;
          return (
            <li key={conv.id} className="group/conv relative">
              <Link
                href={`/admin/whatsapp?c=${conv.id}`}
                className={cn(
                  "tap flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                  on ? "bg-plum/[0.07]" : "hover:bg-zinc-50 active:bg-zinc-100"
                )}
              >
                <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", avatarTone(conv.name))}>
                  {initials(conv.name)}
                  {conv.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[14px] text-zinc-950", conv.unread || on ? "font-semibold" : "font-medium")}>{conv.name}</span>
                    <span className={cn("shrink-0 text-[11px] tabular-nums", conv.unread ? "font-bold text-emerald-600" : "text-zinc-400")}>
                      {timeLabel(conv.at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={cn("flex min-w-0 items-center gap-1 text-[13px]", conv.unread ? "text-zinc-800" : "text-zinc-500")}>
                      {conv.direction === "out" && <CheckCheck size={14} className="shrink-0 text-plum/70" />}
                      <span className="truncate">{waPreview(conv.kind, conv.body, conv.media_name)}</span>
                    </span>
                    {conv.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                        {conv.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
              <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 xl:group-hover/conv:block">
                <DeleteConversationButton contactId={conv.id} name={conv.name} redirectTo={on ? "/admin/whatsapp" : undefined} compact />
              </div>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-zinc-500">
            {term ? `Nenhuma conversa com “${q.trim()}”.` : "Ainda sem conversas. As mensagens recebidas aparecem aqui."}
          </li>
        )}
      </ul>

      <NewConversation open={picker} onClose={() => setPicker(false)} contacts={contacts} />
    </div>
  );
}

/** Escolher um contacto do CRM para começar a conversa. */
function NewConversation({ open, onClose, contacts }: { open: boolean; onClose: () => void; contacts: { id: number; name: string }[] }) {
  const [q, setQ] = useState("");
  const term = normalize(q.trim());
  const list = (term ? contacts.filter((c) => normalize(c.name).includes(term)) : contacts).slice(0, 60);
  const close = () => {
    onClose();
    setQ("");
  };
  return (
    <Modal open={open} onClose={close} title="Nova conversa" description="Contactos do CRM com número de telefone" icon={MessageCirclePlus}>
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar contacto" className="field !pl-10" />
      </label>
      <ul className="mt-3 max-h-[min(50vh,420px)] space-y-0.5 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/whatsapp?c=${c.id}`} onClick={close} className="tap flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-50">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", avatarTone(c.name))}>{initials(c.name)}</span>
              <span className="truncate text-sm font-medium text-zinc-900">{c.name}</span>
            </Link>
          </li>
        ))}
        {list.length === 0 && <li className="py-8 text-center text-sm text-zinc-500">Nenhum contacto encontrado.</li>}
      </ul>
    </Modal>
  );
}
