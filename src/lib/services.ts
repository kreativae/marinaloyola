import { testCalendar } from "@/lib/calendar";
import { getEmailConfig, sendEmail, testEmail } from "@/lib/email";
import { connectionState, getEvolutionConfig, isConfigured } from "@/lib/evolution";
import { getSettings, isOn, readRaw } from "@/lib/settings";
import { SERVICES, type ServiceId } from "@/lib/services-def";
import { getZoomConfig, hasApiCredentials, testZoom } from "@/lib/zoom";

/** Estado mostrado na lista de serviços: ok (verde), partial (âmbar) ou off (cinzento). */
export type ServiceStatus = { tone: "ok" | "partial" | "off"; label: string };

export async function serviceStatuses(): Promise<Record<ServiceId, ServiceStatus>> {
  const [mail, evo, zoom, m] = await Promise.all([
    getEmailConfig(),
    getEvolutionConfig(),
    getZoomConfig(),
    getSettings(["gcal_ical_url", "hotmart_hottok"]),
  ]);
  return {
    geral: { tone: "ok", label: "Configurado" },
    email: mail.apiKey ? { tone: "ok", label: "Ativo" } : { tone: "partial", label: "Pré-visualização" },
    whatsapp: isConfigured(evo) ? { tone: "ok", label: "Configurado" } : { tone: "off", label: "Por configurar" },
    zoom:
      zoom.mode === "off"
        ? { tone: "off", label: "Desligado" }
        : zoom.mode === "api"
          ? hasApiCredentials(zoom)
            ? { tone: "ok", label: "API ativa" }
            : { tone: "partial", label: "Faltam credenciais" }
          : zoom.fixedUrl
            ? { tone: "ok", label: "Sala fixa" }
            : { tone: "partial", label: "Sem link" },
    calendar: m.gcal_ical_url ? { tone: "ok", label: "Sincronizado" } : { tone: "partial", label: "Só exportação" },
    hotmart: m.hotmart_hottok ? { tone: "ok", label: "Ativo" } : { tone: "partial", label: "Sem verificação" },
    agendamento: { tone: "ok", label: "Configurado" },
  };
}

function secretHint(v: string) {
  if (!v) return "";
  if (/^(https?|webcal):/.test(v)) {
    try {
      return `${new URL(v).host}/…`;
    } catch {
      return "URL guardado";
    }
  }
  return `…${v.slice(-4)}`;
}

/** Valores para o formulário. Segredos nunca saem do servidor: só se indica se existem. */
export async function serviceFormState(id: ServiceId) {
  const def = SERVICES.find((s) => s.id === id)!;
  const keys = def.fields.map((f) => f.key);
  const [resolved, raw] = await Promise.all([getSettings(keys), readRaw(keys)]);
  const values: Record<string, string> = {};
  const secrets: Record<string, { set: boolean; hint: string; fromEnv: boolean }> = {};
  for (const f of def.fields) {
    if (f.type === "secret") {
      const v = resolved[f.key];
      secrets[f.key] = {
        set: Boolean(v),
        hint: secretHint(v),
        fromEnv: Boolean(v) && !raw[f.key],
      };
    } else {
      values[f.key] = resolved[f.key];
    }
  }
  return { values, secrets };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function testService(id: ServiceId): Promise<{ ok: boolean; message: string }> {
  try {
    switch (id) {
      case "email": {
        const mail = await getEmailConfig();
        const result = await sendEmail(testEmail(mail.notifyEmail));
        return result === "sent"
          ? { ok: true, message: `Email de teste enviado para ${mail.notifyEmail}.` }
          : {
              ok: true,
              message: `Sem API key: o email foi guardado em .emails/ (pré-visualização). Adicione a chave do Resend para enviar de verdade.`,
            };
      }
      case "whatsapp": {
        const c = await getEvolutionConfig();
        if (!isConfigured(c)) return { ok: false, message: "Preencha o URL e a API key e guarde primeiro." };
        const state = await connectionState(c);
        const labels = {
          open: "Servidor acessível e WhatsApp ligado.",
          connecting: "Servidor acessível. A instância está a ligar: leia o QR code na página WhatsApp.",
          close: "Servidor acessível, mas o WhatsApp não está ligado. Abra a página WhatsApp para ler o QR code.",
          unknown: "Servidor acessível. A instância ainda não existe: será criada ao ligar na página WhatsApp.",
        };
        return { ok: true, message: labels[state] };
      }
      case "zoom": {
        const c = await getZoomConfig();
        if (c.mode === "off") return { ok: true, message: "Modo sem link: os agendamentos não incluem videochamada." };
        if (c.mode === "fixed") {
          if (!c.fixedUrl) return { ok: false, message: "Indique o link da sala e guarde." };
          return { ok: true, message: `Todos os agendamentos vão usar ${c.fixedUrl}` };
        }
        if (!hasApiCredentials(c)) return { ok: false, message: "Faltam Account ID, Client ID ou Client secret." };
        const email = await testZoom(c);
        return { ok: true, message: `Credenciais válidas — conta Zoom ${email}. Cada agendamento cria uma reunião.` };
      }
      case "calendar": {
        const { gcal_ical_url: url, gcal_block_busy: block } = await getSettings(["gcal_ical_url", "gcal_block_busy"]);
        if (!url) return { ok: false, message: "Cole o endereço secreto em formato iCal e guarde primeiro." };
        const busy = await testCalendar(url);
        return {
          ok: true,
          message: `Calendário lido: ${busy.length} evento(s) ocupado(s) nos próximos 30 dias.${
            isOn(block) ? " Estes horários já não aparecem como livres." : " O bloqueio está desligado."
          }`,
        };
      }
      default:
        return { ok: false, message: "Este serviço não tem teste." };
    }
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}
