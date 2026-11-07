"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Loader2, MessageCircleX, MoreHorizontal, Trash2, UserX } from "lucide-react";
import { BottomSheet } from "@/components/sheet";
import { ForceDeleteContactButton } from "@/components/contacts-client";
import { deleteContactAction } from "@/lib/actions-contacts";
import { deleteWhatsappConversation } from "@/lib/actions-whatsapp";
import { CONTACT_STATUS } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Menu que abre por baixo do botão no computador e como painel no telemóvel,
 * onde a fila de botões desliza e um menu suspenso ficaria cortado.
 */
function useMenu() {
  const [open, setOpen] = useState<"pop" | "sheet" | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open !== "pop") return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return {
    wrap,
    open,
    toggle: () => setOpen((o) => (o ? null : window.matchMedia("(max-width: 639px)").matches ? "sheet" : "pop")),
    close: () => setOpen(null),
  };
}

function MenuPanel({ open, onClose, title, children }: { open: "pop" | "sheet" | null; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <>
      {open === "pop" && (
        <div
          role="menu"
          className="pop absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[0_20px_50px_-20px_rgb(24_24_27/0.35)]"
        >
          {children}
        </div>
      )}
      <BottomSheet open={open === "sheet"} onClose={onClose} title={title}>
        <div role="menu" className="pb-2 pt-1 [&_[role=menuitem]]:py-3.5">
          {children}
        </div>
      </BottomSheet>
    </>
  );
}

const itemClass =
  "tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50";

/* ------------------------------ FASE DO CONTACTO ------------------------------ */

export function StatusPicker({ contactId, value, onSelect }: { contactId: number; value: string; onSelect: (contactId: number, status: string) => Promise<void> }) {
  const { wrap, ...menu } = useMenu();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useOptimistic(value);
  const s = CONTACT_STATUS[current] ?? { label: current, className: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30" };

  const pick = (status: string) => {
    menu.close();
    if (status === current) return;
    start(async () => {
      setCurrent(status);
      await onSelect(contactId, status);
    });
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={menu.toggle}
        aria-haspopup="menu"
        aria-expanded={!!menu.open}
        title="Mudar a fase do contacto"
        className={cn("tap inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition-shadow hover:shadow-[0_4px_14px_-6px_currentColor]", s.className)}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <span className="h-2 w-2 rounded-full bg-current" />}
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">Fase</span>
        {s.label}
        <ChevronDown size={13} className={cn("opacity-60 transition-transform duration-200", menu.open && "rotate-180")} />
      </button>
      <MenuPanel open={menu.open} onClose={menu.close} title="Fase do contacto">
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 max-sm:hidden">Fase do contacto</p>
        {Object.entries(CONTACT_STATUS).map(([key, opt]) => {
          const on = key === current;
          return (
            <button key={key} type="button" role="menuitem" onClick={() => pick(key)} className={cn(itemClass, on ? "bg-zinc-50 font-semibold text-zinc-950" : "text-zinc-700 hover:bg-zinc-50")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", opt.className)}>
                <span className="h-2 w-2 rounded-full bg-current" />
              </span>
              <span className="flex-1">{opt.label}</span>
              {on && <Check size={15} className="text-plum" />}
            </button>
          );
        })}
      </MenuPanel>
    </div>
  );
}

/* ------------------------------ MENU DE APAGAR ------------------------------- */

export function ContactDangerMenu({
  id,
  name,
  waCount,
  force,
}: {
  id: number;
  name: string;
  waCount: number;
  /** Só o Super Admin: exclusão forçada, com o que vai ser apagado */
  force?: { items: { label: string; count: number }[]; hasAccount: boolean };
}) {
  const router = useRouter();
  const { wrap, ...menu } = useMenu();
  const [forceOpen, setForceOpen] = useState(false);
  const [pending, start] = useTransition();

  const deleteConversation = () => {
    menu.close();
    const n = ` (${waCount} mensage${waCount === 1 ? "m" : "ns"})`;
    if (!confirm(`Apagar a conversa com "${name}"${n}? As mensagens e ficheiros saem da plataforma; o contacto e a ficha no CRM ficam. No WhatsApp do telemóvel a conversa não é apagada.`)) return;
    start(async () => {
      await deleteWhatsappConversation(id);
      router.refresh();
    });
  };

  const deleteContact = () => {
    menu.close();
    if (!confirm(`Apagar "${name}"? O histórico e as conversas de WhatsApp deste contacto também são apagados. Esta acção não pode ser desfeita.`)) return;
    start(async () => {
      const r = await deleteContactAction(id);
      if (r?.error) alert(r.error);
    });
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={menu.toggle}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={!!menu.open}
        aria-label="Mais ações"
        title="Mais ações"
        className={cn(
          "tap flex h-[38px] w-[38px] items-center justify-center rounded-full border bg-white text-zinc-600 transition-colors hover:border-plum/40 hover:text-plum disabled:opacity-50",
          menu.open ? "border-plum/40 text-plum" : "border-zinc-200"
        )}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={17} />}
      </button>
      <MenuPanel open={menu.open} onClose={menu.close} title="Apagar">
        {waCount > 0 && (
          <button type="button" role="menuitem" onClick={deleteConversation} className={cn(itemClass, "text-zinc-700 hover:bg-rose-50 hover:text-rose-700")}>
            <MessageCircleX size={16} className="shrink-0 text-rose-500" />
            <span className="flex-1">
              Apagar conversa
              <span className="block text-[11px] text-zinc-400">{waCount} mensage{waCount === 1 ? "m" : "ns"} de WhatsApp</span>
            </span>
          </button>
        )}
        <button type="button" role="menuitem" onClick={deleteContact} className={cn(itemClass, "text-zinc-700 hover:bg-rose-50 hover:text-rose-700")}>
          <UserX size={16} className="shrink-0 text-rose-500" />
          <span className="flex-1">
            Apagar contacto
            <span className="block text-[11px] text-zinc-400">Com o histórico e as conversas</span>
          </span>
        </button>
        {force && (
          <>
            <div className="mx-3 my-1.5 h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                menu.close();
                setForceOpen(true);
              }}
              className={cn(itemClass, "font-semibold text-rose-600 hover:bg-rose-50")}
            >
              <AlertTriangle size={16} className="shrink-0" />
              <span className="flex-1">
                Exclusão forçada
                <span className="block text-[11px] font-normal text-rose-400">Apaga tudo, mesmo com pagamentos</span>
              </span>
            </button>
          </>
        )}
      </MenuPanel>
      {force && (
        <ForceDeleteContactButton id={id} name={name} items={force.items} hasAccount={force.hasAccount} open={forceOpen} onOpenChange={setForceOpen} />
      )}
    </div>
  );
}

