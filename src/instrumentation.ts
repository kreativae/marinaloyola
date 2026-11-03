/** Arranque do servidor: liga a verificação dos lembretes da Agenda (a cada minuto). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __remindersTimer?: ReturnType<typeof setInterval> };
  if (g.__remindersTimer) return;
  const { sendDueReminders } = await import("@/lib/reminders");
  const tick = () => sendDueReminders().catch((e) => console.error("[lembrete] verificação falhou:", e));
  g.__remindersTimer = setInterval(tick, 60_000);
  setTimeout(tick, 15_000);
}
