"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteSettings, getToken, saveSettings } from "@/lib/settings";
import { getService, type ServiceId } from "@/lib/services-def";
import { testService } from "@/lib/services";
import { syncCalendar } from "@/lib/calendar";

export type SaveResult = { ok: boolean; message?: string; errors?: Record<string, string>; savedAt?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveServiceAction(id: ServiceId, _prev: SaveResult | null, fd: FormData): Promise<SaveResult> {
  await requireAdmin();
  const def = getService(id);
  if (!def) return { ok: false, message: "Serviço desconhecido." };

  const values: Record<string, string> = {};
  const clear: string[] = [];
  const errors: Record<string, string> = {};

  for (const f of def.fields) {
    const raw = String(fd.get(f.key) ?? "").trim();
    switch (f.type) {
      case "toggle":
        values[f.key] = fd.get(f.key) === "1" ? "1" : "0";
        break;
      case "secret":
        // Campo vazio mantém o valor guardado; a caixa "remover" apaga-o
        if (fd.get(`clear_${f.key}`) === "1") clear.push(f.key);
        else if (raw) values[f.key] = raw;
        break;
      case "number": {
        if (!raw) {
          clear.push(f.key);
          break;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
          errors[f.key] = `Entre ${f.min ?? 0} e ${f.max ?? "∞"}.`;
        } else values[f.key] = String(Math.round(n));
        break;
      }
      case "email":
        if (raw && !EMAIL_RE.test(raw)) errors[f.key] = "Email inválido.";
        else values[f.key] = raw.toLowerCase();
        break;
      case "url":
        if (raw && !/^https?:\/\/[^\s]+$/i.test(raw)) errors[f.key] = "Tem de começar por http:// ou https://";
        else values[f.key] = raw.replace(/\/+$/, "");
        break;
      case "select":
        if (f.options?.some((o) => o.value === raw)) values[f.key] = raw;
        break;
      default:
        values[f.key] = raw;
    }
  }
  if (id === "calendar" && values.gcal_ical_url && !/^(https?|webcal):\/\//i.test(values.gcal_ical_url)) {
    errors.gcal_ical_url = "Cole o endereço completo (https://…/basic.ics).";
  }
  if (id === "geral" && values.whatsapp_number) {
    values.whatsapp_number = values.whatsapp_number.replace(/\D/g, "");
    if (values.whatsapp_number.length < 9) errors.whatsapp_number = "Número incompleto.";
  }
  if (Object.keys(errors).length) return { ok: false, message: "Corrija os campos assinalados.", errors };

  // Vazio num campo de texto = voltar ao valor por omissão / variável de ambiente
  const empty = Object.entries(values).filter(([, v]) => v === "").map(([k]) => k);
  for (const k of empty) delete values[k];
  await saveSettings(values);
  await deleteSettings([...clear, ...empty]);

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout"); // número de WhatsApp e email público no site
  return { ok: true, message: "Definições guardadas.", savedAt: Date.now() };
}

export async function testServiceAction(id: ServiceId) {
  await requireAdmin();
  return testService(id);
}

export async function regenerateCalendarFeed() {
  await requireAdmin();
  await getToken("calendar_feed_token", true);
  revalidatePath("/admin/config");
}

/** Botão "Sincronizar agora" da Agenda: relê o Google Calendar e actualiza as páginas que o usam. */
export async function syncGoogleCalendar() {
  await requireAdmin();
  const r = await syncCalendar();
  revalidatePath("/admin/agenda");
  revalidatePath("/agendar");
  return r;
}
