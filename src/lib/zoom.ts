import { getSettings } from "@/lib/settings";

/**
 * Zoom — app Server-to-Server OAuth (https://developers.zoom.us/docs/internal-apps/s2s-oauth/).
 * Modos: "api" cria uma reunião por agendamento, "fixed" usa sempre a mesma sala, "off" não gera link.
 */

export type ZoomConfig = {
  mode: "api" | "fixed" | "off";
  accountId: string;
  clientId: string;
  clientSecret: string;
  fixedUrl: string;
};

export async function getZoomConfig(): Promise<ZoomConfig> {
  const m = await getSettings([
    "zoom_mode",
    "zoom_account_id",
    "zoom_client_id",
    "zoom_client_secret",
    "zoom_fixed_url",
  ]);
  return {
    mode: (["api", "fixed", "off"].includes(m.zoom_mode) ? m.zoom_mode : "fixed") as ZoomConfig["mode"],
    accountId: m.zoom_account_id,
    clientId: m.zoom_client_id,
    clientSecret: m.zoom_client_secret,
    fixedUrl: m.zoom_fixed_url,
  };
}

export const hasApiCredentials = (c: ZoomConfig) => Boolean(c.accountId && c.clientId && c.clientSecret);

// O token dura 1 hora; reutiliza-o enquanto for válido para as mesmas credenciais
let cached: { key: string; token: string; expires: number } | null = null;

async function accessToken(c: ZoomConfig) {
  const key = `${c.accountId}:${c.clientId}:${c.clientSecret}`;
  if (cached && cached.key === key && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(c.accountId)}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}` },
      cache: "no-store",
    }
  );
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; reason?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoom recusou as credenciais (${res.status}): ${data.reason ?? data.error ?? "erro desconhecido"}`);
  }
  cached = { key, token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function zoomApi<T>(c: ZoomConfig, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken(c)}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`Zoom ${res.status}: ${data.message ?? "pedido falhou"}`);
  return data;
}

/** Valida as credenciais e devolve a conta a que pertencem. */
export async function testZoom(c: ZoomConfig) {
  const me = await zoomApi<{ email: string; first_name?: string; last_name?: string }>(c, "GET", "/users/me");
  return me.email;
}

/**
 * Link para um novo agendamento. Nunca lança: se a API falhar, usa a sala fixa (se houver)
 * e devolve o erro para ficar registado no histórico do contacto.
 */
export async function meetingLinkFor(topic: string, startAt: Date, durationMin: number) {
  const c = await getZoomConfig();
  if (c.mode === "off") return { url: null, source: "off" as const };
  if (c.mode === "api" && hasApiCredentials(c)) {
    try {
      const m = await zoomApi<{ join_url: string }>(c, "POST", "/users/me/meetings", {
        topic,
        type: 2,
        start_time: startAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        duration: durationMin,
        timezone: "Europe/Lisbon",
        settings: { join_before_host: false, waiting_room: true },
      });
      return { url: m.join_url, source: "api" as const };
    } catch (e) {
      return { url: c.fixedUrl || null, source: "fixed" as const, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { url: c.fixedUrl || null, source: "fixed" as const };
}
