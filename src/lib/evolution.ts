import { getSettings, getToken } from "@/lib/settings";

/**
 * Cliente da Evolution API v2 (https://doc.evolution-api.com).
 * Credenciais em Configurações → WhatsApp ou, em alternativa, variáveis de ambiente.
 */

export type EvolutionConfig = {
  url: string;
  apiKey: string;
  instance: string;
  webhookToken: string;
  appUrl: string;
};

export type ConnectionState = "open" | "connecting" | "close" | "unknown";

export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  const [m, webhookToken] = await Promise.all([
    getSettings(["evolution_url", "evolution_api_key", "evolution_instance", "app_url"]),
    getToken("evolution_webhook_token"),
  ]);
  return {
    url: m.evolution_url.replace(/\/+$/, ""),
    apiKey: m.evolution_api_key,
    instance: m.evolution_instance || "marina-loyola",
    webhookToken,
    appUrl: m.app_url.replace(/\/+$/, ""),
  };
}

export const isConfigured = (c: EvolutionConfig) => Boolean(c.url && c.apiKey);

export const webhookUrl = (c: EvolutionConfig) =>
  `${c.appUrl}/api/webhooks/evolution?token=${c.webhookToken}`;

async function call<T>(c: EvolutionConfig, method: string, path: string, body?: unknown): Promise<T> {
  if (!isConfigured(c)) throw new Error("Evolution API não configurada.");
  const res = await fetch(`${c.url}${path}`, {
    method,
    headers: { apikey: c.apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE"];

export async function connectionState(c: EvolutionConfig): Promise<ConnectionState> {
  try {
    const r = await call<{ instance?: { state?: string } }>(
      c,
      "GET",
      `/instance/connectionState/${encodeURIComponent(c.instance)}`
    );
    const s = r.instance?.state;
    return s === "open" || s === "connecting" || s === "close" ? s : "unknown";
  } catch (e) {
    // 404 = a instância ainda não existe
    if (String(e).includes("Evolution 404")) return "close";
    throw e;
  }
}

/** Cria a instância (se preciso), regista o webhook e devolve o QR code em base64. */
export async function connect(c: EvolutionConfig): Promise<{ qr: string | null; state: ConnectionState }> {
  const state = await connectionState(c);
  if (state === "open") {
    await setWebhook(c);
    return { qr: null, state };
  }
  try {
    await call(c, "POST", "/instance/create", {
      instanceName: c.instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: { url: webhookUrl(c), byEvents: false, base64: false, events: WEBHOOK_EVENTS },
    });
  } catch (e) {
    // 403/409 = já existe; segue para o QR
    if (!/Evolution (403|409)/.test(String(e))) throw e;
    await setWebhook(c);
  }
  const r = await call<{ base64?: string; code?: string }>(
    c,
    "GET",
    `/instance/connect/${encodeURIComponent(c.instance)}`
  );
  return { qr: r.base64 ?? null, state: "connecting" };
}

export async function setWebhook(c: EvolutionConfig) {
  await call(c, "POST", `/webhook/set/${encodeURIComponent(c.instance)}`, {
    webhook: {
      enabled: true,
      url: webhookUrl(c),
      byEvents: false,
      base64: false,
      events: WEBHOOK_EVENTS,
    },
  });
}

export async function logout(c: EvolutionConfig) {
  await call(c, "DELETE", `/instance/logout/${encodeURIComponent(c.instance)}`);
}

export async function sendText(c: EvolutionConfig, number: string, text: string) {
  const r = await call<{ key?: { id?: string } }>(
    c,
    "POST",
    `/message/sendText/${encodeURIComponent(c.instance)}`,
    { number, text }
  );
  return { id: r.key?.id ?? null };
}

/* -------------------------------- TELEFONES ----------------------------- */

/** Número em formato internacional só com dígitos (ex: 351912345678). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("9")) d = `351${d}`; // telemóvel PT sem indicativo
  return d.length >= 10 ? d : null;
}

/** Formata para mostrar: 351912345678 → +351 912 345 678 */
export function formatPhone(digits: string) {
  if (digits.startsWith("351") && digits.length === 12) {
    return `+351 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return `+${digits}`;
}
