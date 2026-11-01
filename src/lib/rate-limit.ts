import { headers } from "next/headers";

/**
 * Limite de pedidos por IP para as ações públicas (entrar, formulários, marcações).
 * Fica em memória do servidor: reinicia com o deploy, o que chega para travar robôs e tentativas em massa.
 */

const hits = new Map<string, number[]>();

/** IP de quem fez o pedido (o proxy do Coolify põe-no em x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

/** Regista um pedido e devolve false se o IP já passou de `max` pedidos na janela indicada. */
export async function allow(bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${await clientIp()}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 20_000) hits.clear();
  return true;
}
