"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, QrCode, RefreshCw, Send } from "lucide-react";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappStatus,
  sendWhatsappMessage,
} from "@/lib/actions-whatsapp";
import type { ConnectionState } from "@/lib/evolution";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<ConnectionState, { label: string; dot: string }> = {
  open: { label: "Ligado", dot: "bg-emerald-500" },
  connecting: { label: "A aguardar leitura do QR", dot: "bg-amber-500" },
  close: { label: "Desligado", dot: "bg-zinc-400" },
  unknown: { label: "Sem ligação à API", dot: "bg-rose-500" },
};

export function WhatsappConnection({
  initialState,
  configured,
}: {
  initialState: ConnectionState;
  configured: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>(initialState);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Enquanto o QR está visível, verifica a ligação a cada 3s
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const r = await getWhatsappStatus();
      if (r.state === "open") {
        setQr(null);
        setState("open");
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [qr, router]);

  const s = STATE_LABEL[state];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
          <span className="text-sm font-semibold text-zinc-900">{s.label}</span>
        </div>
        <button
          type="button"
          title="Verificar estado"
          disabled={pending || !configured}
          onClick={() =>
            start(async () => {
              const r = await getWhatsappStatus();
              setState(r.state);
              setError(r.error ?? null);
            })
          }
          className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
        >
          <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
        </button>
      </div>

      {qr && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code do WhatsApp" className="mx-auto h-56 w-56 rounded-lg bg-white p-2" />
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            No telemóvel: WhatsApp → Definições → Dispositivos ligados → Ligar dispositivo.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs leading-relaxed text-rose-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {state !== "open" ? (
          <button
            type="button"
            disabled={pending || !configured}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await connectWhatsapp();
                setState(r.state);
                setQr(r.qr ?? null);
                if (r.error) setError(r.error);
                if (r.state === "open") router.refresh();
              })
            }
            className="btn-primary !px-4 !py-2 !text-xs disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
            {qr ? "Gerar novo QR" : "Ligar WhatsApp"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Desligar o WhatsApp desta plataforma?")) return;
              start(async () => {
                const r = await disconnectWhatsapp();
                if (r.error) setError(r.error);
                else setState("close");
              });
            }}
            className="btn-ghost !px-4 !py-2 !text-xs"
          >
            <LogOut size={14} /> Desligar
          </button>
        )}
      </div>
      {!configured && (
        <p className="mt-3 text-xs text-zinc-500">Preencha as definições da Evolution API abaixo.</p>
      )}
    </div>
  );
}

export function ReplyBox({ contactId, disabled }: { contactId: number; disabled?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const r = await sendWhatsappMessage(contactId, body);
      if (r.ok) {
        setText("");
        setError(null);
        router.refresh();
      } else {
        setError(r.error ?? "Não foi possível enviar.");
      }
    });
  }

  return (
    <div className="border-t border-zinc-200 bg-white p-3">
      {error && <p className="mb-2 px-1 text-xs text-rose-600">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={disabled ? "Ligue o WhatsApp para responder" : "Escreva uma mensagem…  (Enter envia, Shift+Enter nova linha)"}
          className="field max-h-40 min-h-[44px] flex-1 resize-y"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || disabled || !text.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-white transition-colors hover:bg-plum-ink disabled:opacity-40"
          title="Enviar"
        >
          {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}

/** Actualiza a página periodicamente para mostrar mensagens novas. */
export function AutoRefresh({ every = 5000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [every, router]);
  return null;
}

/** Mantém a conversa encostada à mensagem mais recente. */
export function ScrollToBottom({ dep }: { dep: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [dep]);
  return <div ref={ref} />;
}
