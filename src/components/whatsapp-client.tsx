"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  Mic,
  Paperclip,
  Pencil,
  Play,
  QrCode,
  RefreshCw,
  Send,
  Square,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  connectWhatsapp,
  deleteWhatsappMessage,
  disconnectWhatsapp,
  getWhatsappStatus,
  renameWhatsappContact,
  sendWhatsappFileAction,
  sendWhatsappMessage,
} from "@/lib/actions-whatsapp";
import { WA_MAX_DOCUMENT, WA_MAX_MEDIA, waPreview } from "@/lib/whatsapp-def";
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
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rec = useRecorder();

  const busy = pending || disabled;

  function sendText() {
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

  function sendFile(f: File, caption: string, voice: boolean) {
    const limit = voice || !/^(image|video|audio)\//.test(f.type) ? WA_MAX_DOCUMENT : WA_MAX_MEDIA;
    if (f.size > limit) {
      setError(`Ficheiro demasiado grande (máximo ${Math.round(limit / 1_000_000)} MB).`);
      return;
    }
    const fd = new FormData();
    fd.set("file", f);
    fd.set("caption", caption);
    if (voice) fd.set("voice", "1");
    start(async () => {
      const r = await sendWhatsappFileAction(contactId, fd);
      if (r.ok) {
        setFile(null);
        setText("");
        setError(null);
        router.refresh();
      } else {
        setError(r.error ?? "Não foi possível enviar o ficheiro.");
      }
    });
  }

  const send = () => (file ? sendFile(file, text.trim(), false) : sendText());

  return (
    <div
      className="border-t border-zinc-200 bg-white p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled) setFile(f);
      }}
    >
      {error && <p className="mb-2 px-1 text-xs text-rose-600">{error}</p>}
      {file && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2 pr-3">
          <FilePreview file={file} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">{file.name}</p>
            <p className="text-[11px] text-zinc-500">{fmtSize(file.size)} · escreva uma legenda (opcional) e envie</p>
          </div>
          <button type="button" onClick={() => setFile(null)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white hover:text-zinc-900" aria-label="Retirar ficheiro">
            <X size={15} />
          </button>
        </div>
      )}

      {rec.state !== "idle" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2">
          <button type="button" onClick={rec.cancel} className="rounded-full p-2 text-zinc-500 hover:bg-white hover:text-rose-600" aria-label="Cancelar gravação" title="Cancelar">
            <Trash2 size={17} />
          </button>
          {rec.state === "recording" ? (
            <span className="flex flex-1 items-center gap-2 text-sm font-semibold text-rose-600">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /> A gravar… {fmtDuration(rec.seconds)}
            </span>
          ) : (
            <audio src={rec.url ?? undefined} controls className="h-9 min-w-0 flex-1" />
          )}
          {rec.state === "recording" ? (
            <button type="button" onClick={rec.stop} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white" aria-label="Parar gravação" title="Parar">
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => rec.blob && sendFile(new File([rec.blob], `audio.${rec.ext}`, { type: rec.blob.type }), "", true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-white hover:bg-plum-ink disabled:opacity-40"
              aria-label="Enviar áudio"
              title="Enviar áudio"
            >
              {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-plum disabled:opacity-40"
            aria-label="Anexar ficheiro"
            title="Anexar foto, vídeo ou documento"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const f = e.clipboardData.files?.[0];
              if (f && !disabled) {
                e.preventDefault();
                setFile(f);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder={disabled ? "Ligue o WhatsApp para responder" : file ? "Legenda (opcional)…" : "Escreva uma mensagem…  (Enter envia, Shift+Enter nova linha)"}
            className="field max-h-40 min-h-[44px] flex-1 resize-y"
          />
          {text.trim() || file ? (
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-white transition-colors hover:bg-plum-ink disabled:opacity-40"
              title="Enviar"
            >
              {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setError(null);
                const err = await rec.start();
                if (err) setError(err);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-white transition-colors hover:bg-plum-ink disabled:opacity-40"
              title="Gravar mensagem de voz"
              aria-label="Gravar mensagem de voz"
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function FilePreview({ file }: { file: File }) {
  const url = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />;
  }
  const Icon = file.type.startsWith("video/") ? Film : file.type.startsWith("audio/") ? Mic : FileText;
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-plum/10 text-plum">
      <Icon size={20} />
    </span>
  );
}

/** Gravação de mensagens de voz com o microfone do browser. */
function useRecorder() {
  const [state, setState] = useState<"idle" | "recording" | "ready">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const discard = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const reset = () => {
    setState("idle");
    setBlob(null);
    setUrl(null);
    setSeconds(0);
  };

  async function start(): Promise<string | null> {
    if (typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices) return "Este browser não consegue gravar áudio.";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return "Sem acesso ao microfone. Autorize o microfone no browser.";
    }
    const type = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    discard.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      if (discard.current) return reset();
      const b = new Blob(chunks.current, { type: (r.mimeType || type || "audio/webm").split(";")[0] });
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      setState("ready");
    };
    recorder.current = r;
    r.start();
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return null;
  }

  const ext = blob?.type.includes("ogg") ? "ogg" : blob?.type.includes("mp4") ? "m4a" : "webm";

  return {
    state,
    seconds,
    blob,
    url,
    ext,
    start,
    stop: () => recorder.current?.state === "recording" && recorder.current.stop(),
    cancel: () => {
      if (recorder.current?.state === "recording") {
        discard.current = true;
        recorder.current.stop();
      } else reset();
    },
  };
}

/* ------------------------------- MENSAGENS ------------------------------ */

export type WaMessage = {
  id: number;
  direction: string;
  body: string;
  kind: string;
  mediaMime: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  mediaSeconds: number | null;
  downloaded: boolean;
  canFetch: boolean;
  deletable: boolean;
  at: string;
};

/**
 * Uma mensagem da conversa. Fotos, áudios e vídeos recebidos só são pedidos ao servidor
 * quando se clica em "Ver foto" / "Ouvir" (os enviados por nós aparecem logo).
 */
export function MessageBubble({ m, readOnly }: { m: WaMessage; readOnly?: boolean }) {
  const router = useRouter();
  const out = m.direction === "out";
  const [show, setShow] = useState(m.downloaded);
  const [failed, setFailed] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const src = `/api/whatsapp/media/${m.id}`;
  const isMedia = m.kind !== "text" && m.kind !== "location" && m.kind !== "contact";
  const available = m.downloaded || m.canFetch;

  const check = async () => {
    // Mostra a mensagem de erro do servidor (ex: ficheiro expirado) em vez de uma imagem partida
    const r = await fetch(src, { method: "GET", cache: "no-store" });
    if (!r.ok) setFailed((await r.text()) || "Não foi possível abrir o ficheiro.");
  };

  const remove = (forEveryone: boolean) =>
    start(async () => {
      setError(null);
      const r = await deleteWhatsappMessage(m.id, forEveryone);
      if (!r.ok) setError(r.error ?? "Não foi possível apagar.");
      else {
        setMenu(false);
        router.refresh();
      }
    });

  const time = new Date(m.at).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
  const reveal = (label: string, Icon: typeof ImageIcon) => (
    <button
      type="button"
      onClick={() => {
        setShow(true);
        setFailed(null);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
        out ? "bg-white/15 hover:bg-white/25" : "bg-zinc-100 hover:bg-zinc-200/70"
      )}
    >
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {m.mediaSize ? <span className="text-[11px] font-normal opacity-70">{fmtSize(m.mediaSize)}</span> : null}
    </button>
  );

  let media: React.ReactNode = null;
  if (isMedia) {
    if (!available) {
      media = <p className="text-xs italic opacity-80">{waPreview(m.kind, "", m.mediaName)} (indisponível)</p>;
    } else if (failed) {
      media = (
        <div className="space-y-2">
          <p className="text-xs opacity-80">{failed}</p>
          {reveal("Tentar de novo", RefreshCw)}
        </div>
      );
    } else if (m.kind === "image" || m.kind === "sticker") {
      media = show ? (
        <a href={src} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={m.body || "Foto"}
            onError={check}
            className={cn("rounded-xl object-cover", m.kind === "sticker" ? "h-32 w-32 object-contain" : "max-h-80 w-full min-w-[200px] bg-black/5")}
          />
        </a>
      ) : (
        reveal(m.kind === "sticker" ? "Ver sticker" : "Ver foto", ImageIcon)
      );
    } else if (m.kind === "audio") {
      media = show ? (
        <audio src={src} controls autoPlay={!m.downloaded} onError={check} className="h-10 w-64 max-w-full" />
      ) : (
        reveal(`Ouvir áudio${m.mediaSeconds ? ` · ${fmtDuration(m.mediaSeconds)}` : ""}`, Play)
      );
    } else if (m.kind === "video") {
      media = show ? (
        <video src={src} controls onError={check} className="max-h-80 w-full min-w-[220px] rounded-xl bg-black" />
      ) : (
        reveal("Ver vídeo", Film)
      );
    } else {
      media = (
        <a
          href={`${src}?dl=1`}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            out ? "bg-white/15 hover:bg-white/25" : "bg-zinc-100 hover:bg-zinc-200/70"
          )}
        >
          <FileText size={20} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{m.mediaName || "Documento"}</span>
            <span className="text-[11px] opacity-70">{m.mediaSize ? `${fmtSize(m.mediaSize)} · ` : ""}Descarregar</span>
          </span>
          <Download size={16} className="shrink-0" />
        </a>
      );
    }
  }

  return (
    <div className={cn("group flex items-center gap-1.5", out ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isMedia && "px-2.5 pt-2.5",
          out ? "rounded-br-md bg-plum text-white" : "rounded-bl-md border border-zinc-200 bg-white text-zinc-800"
        )}
      >
        {media}
        {m.kind === "location" ? (
          <a href={m.body.split("\n").pop()} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold underline-offset-2 hover:underline">
            <MapPin size={15} /> {m.body.includes("\n") ? m.body.split("\n")[0] : "Ver localização"}
          </a>
        ) : m.kind === "contact" ? (
          <span className="flex items-center gap-2 font-semibold">
            <UserRound size={15} /> {m.body}
          </span>
        ) : (
          m.body && <p className={cn(isMedia && "mt-2 px-1.5")}>{m.body}</p>
        )}
        <span className={cn("mt-1 block text-right text-[10px]", isMedia && "px-1.5", out ? "text-white/70" : "text-zinc-500")}>{time}</span>
      </div>

      {!readOnly && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            className={cn("rounded-full p-1.5 text-zinc-400 transition-opacity hover:bg-zinc-200/70 hover:text-zinc-700", menu ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100")}
            aria-label="Opções da mensagem"
            title="Apagar mensagem"
          >
            <Trash2 size={14} />
          </button>
          {menu && (
            <div className={cn("absolute top-1/2 z-20 w-56 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-1.5 text-sm shadow-xl", out ? "right-full mr-1" : "left-full ml-1")}>
              <button type="button" disabled={pending} onClick={() => remove(false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-50">
                <Trash2 size={14} /> Apagar só aqui
              </button>
              {out && m.deletable && (
                <button type="button" disabled={pending} onClick={() => remove(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-600 hover:bg-rose-50">
                  <Trash2 size={14} /> Apagar para todos
                </button>
              )}
              <button type="button" onClick={() => setMenu(false)} className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-50">
                Cancelar
              </button>
              {pending && <Loader2 size={14} className="mx-3 my-1 animate-spin text-plum" />}
              {error && <p className="px-3 pb-1.5 text-xs text-rose-600">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Nome do contacto no topo da conversa, editável. */
export function ContactNameEditor({ contactId, name }: { contactId: number; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const v = value.trim();
      if (!v || v === name) {
        setEditing(false);
        setValue(name);
        return;
      }
      const r = await renameWhatsappContact(contactId, v);
      if (r.ok) {
        setEditing(false);
        setError(null);
        router.refresh();
      } else setError(r.error ?? "Não foi possível guardar.");
    });

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="group/name flex max-w-full items-center gap-1.5 text-left" title="Editar nome">
        <span className="truncate font-semibold text-zinc-950">{name}</span>
        <Pencil size={13} className="shrink-0 text-zinc-300 transition-colors group-hover/name:text-plum" />
      </button>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setEditing(false);
              setValue(name);
            }
          }}
          className="field !h-8 !py-1 !text-sm font-semibold"
        />
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-plum p-1.5 text-white" aria-label="Guardar nome">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(name);
          }}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
          aria-label="Cancelar"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
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
