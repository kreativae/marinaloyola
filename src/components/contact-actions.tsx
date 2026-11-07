"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, MessageCircleX, MoreHorizontal, UserX } from "lucide-react";
import { ChoicePicker, MenuPanel, menuItemClass, useMenu } from "@/components/dropdown";
import { ForceDeleteContactButton } from "@/components/contacts-client";
import { deleteContactAction } from "@/lib/actions-contacts";
import { deleteWhatsappConversation } from "@/lib/actions-whatsapp";
import { cn, CONTACT_STATUS } from "@/lib/utils";

/* ------------------------------ FASE DO CONTACTO ------------------------------ */

const PHASES = Object.entries(CONTACT_STATUS).map(([value, s]) => ({ value, label: s.label, tone: s.className }));

export function StatusPicker({ contactId, value, onSelect }: { contactId: number; value: string; onSelect: (contactId: number, status: string) => Promise<void> }) {
  return <ChoicePicker value={value} options={PHASES} onSelect={(v) => onSelect(contactId, v)} title="Fase do contacto" prefix="Fase" align="left" />;
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
      <MenuPanel open={menu.open} place={menu.place} onClose={menu.close} title="Apagar">
        {waCount > 0 && (
          <button type="button" role="menuitem" onClick={deleteConversation} className={cn(menuItemClass, "text-zinc-700 hover:bg-rose-50 hover:text-rose-700")}>
            <MessageCircleX size={16} className="shrink-0 text-rose-500" />
            <span className="flex-1">
              Apagar conversa
              <span className="block text-[11px] text-zinc-400">{waCount} mensage{waCount === 1 ? "m" : "ns"} de WhatsApp</span>
            </span>
          </button>
        )}
        <button type="button" role="menuitem" onClick={deleteContact} className={cn(menuItemClass, "text-zinc-700 hover:bg-rose-50 hover:text-rose-700")}>
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
              className={cn(menuItemClass, "font-semibold text-rose-600 hover:bg-rose-50")}
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

