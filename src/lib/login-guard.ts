/**
 * Bloqueio temporário após várias palavras-passe erradas para o mesmo email
 * (memória do servidor: reinicia com o deploy, o que é suficiente contra tentativas automáticas).
 */
/** Durações possíveis da sessão, em dias (Configurações → Segurança). */
export const SESSION_DAYS = [1, 7, 30, 90] as const;

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

const attempts = new Map<string, { count: number; last: number; until: number }>();

export function isLocked(email: string) {
  const a = attempts.get(email);
  return !!a && a.until > Date.now();
}

export function registerFailure(email: string) {
  const now = Date.now();
  const a = attempts.get(email);
  // Tentativas contam numa janela de 15 minutos; depois de um bloqueio recomeça do zero
  const fresh = !a || a.last < now - LOCK_MINUTES * 60_000 || (a.until && a.until <= now);
  const count = fresh ? 1 : a.count + 1;
  attempts.set(email, { count, last: now, until: count >= MAX_ATTEMPTS ? now + LOCK_MINUTES * 60_000 : 0 });
  if (attempts.size > 5000) attempts.clear();
}

export function clearFailures(email: string) {
  attempts.delete(email);
}
