/**
 * Definição dos serviços configuráveis em Configurações.
 * Sem imports de servidor: é partilhado com o formulário (componente cliente).
 */

export type FieldType = "text" | "secret" | "email" | "url" | "number" | "toggle" | "select" | "textarea";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  default?: string;
  /** Variável de ambiente usada quando o campo não está preenchido */
  env?: string;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Só mostrar quando outro campo tem um destes valores */
  showIf?: { key: string; values: string[] };
  min?: number;
  max?: number;
};

export type ServiceId = "geral" | "email" | "whatsapp" | "zoom" | "calendar" | "hotmart" | "agendamento";

export type ServiceDef = {
  id: ServiceId;
  name: string;
  summary: string;
  fields: FieldDef[];
  /** Tem botão "Testar ligação" */
  testable?: boolean;
  testLabel?: string;
};

export const SERVICES: ServiceDef[] = [
  {
    id: "geral",
    name: "Geral & marca",
    summary: "Contactos públicos do site e o endereço da plataforma.",
    fields: [
      {
        key: "whatsapp_number",
        label: "Número de WhatsApp público",
        type: "text",
        default: "351912345678",
        help: "Formato internacional, sem +. Alimenta os botões de WhatsApp do site.",
      },
      {
        key: "contact_email",
        label: "Email de contacto público",
        type: "email",
        default: "ola@marinaloyola.com",
        help: "Mostrado no rodapé e na página de contacto.",
      },
      {
        key: "app_url",
        label: "URL pública da plataforma",
        type: "url",
        env: "APP_URL",
        default: "http://localhost:3000",
        help: "Usado para gerar os endereços de webhooks e do feed de calendário.",
      },
    ],
  },
  {
    id: "email",
    name: "Email (Resend)",
    summary: "Emails transacionais: confirmações de agendamento e avisos para a equipa.",
    testable: true,
    testLabel: "Enviar email de teste",
    fields: [
      {
        key: "resend_api_key",
        label: "API key do Resend",
        type: "secret",
        env: "RESEND_API_KEY",
        placeholder: "re_…",
        help: "resend.com → API Keys. Sem chave, os emails ficam guardados em .emails/ (modo de pré-visualização).",
      },
      {
        key: "email_from",
        label: "Remetente",
        type: "text",
        env: "EMAIL_FROM",
        default: "Marina Loyola <ola@marinaloyola.com>",
        help: "O domínio tem de estar verificado no Resend.",
      },
      {
        key: "notify_email",
        label: "Email que recebe os avisos",
        type: "email",
        placeholder: "Vazio = email de contacto público",
        help: "Para onde vão os avisos de novos agendamentos. Também é o endereço de resposta das clientes.",
      },
      { key: "email_booking_client", label: "Enviar confirmação à cliente (com convite .ics)", type: "toggle", default: "1" },
      { key: "email_booking_admin", label: "Avisar a equipa de cada novo agendamento", type: "toggle", default: "1" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp (Evolution API)",
    summary: "Caixa de entrada, leads automáticos e confirmações por WhatsApp.",
    testable: true,
    testLabel: "Testar ligação",
    fields: [
      {
        key: "evolution_url",
        label: "URL da Evolution API",
        type: "url",
        env: "EVOLUTION_API_URL",
        placeholder: "https://evolution.seudominio.com",
      },
      {
        key: "evolution_api_key",
        label: "API key global",
        type: "secret",
        env: "EVOLUTION_API_KEY",
        help: "AUTHENTICATION_API_KEY do servidor Evolution.",
      },
      {
        key: "evolution_instance",
        label: "Nome da instância",
        type: "text",
        env: "EVOLUTION_INSTANCE",
        default: "marina-loyola",
        help: "Criada automaticamente ao ligar o WhatsApp pela primeira vez.",
      },
      {
        key: "wa_auto_lead",
        label: "Criar lead quando um número desconhecido escreve",
        type: "toggle",
        default: "1",
        help: "Desligado: mensagens de números fora do CRM são ignoradas.",
      },
      { key: "wa_booking_confirm", label: "Enviar confirmação de agendamento por WhatsApp", type: "toggle", default: "1" },
      {
        key: "wa_booking_template",
        label: "Mensagem de confirmação",
        type: "textarea",
        default:
          "Olá {nome}! A sua {sessao} está confirmada para {data}.\n\n{link}\n\nAté breve,\nMarina Loyola",
        help: "Variáveis: {nome}, {sessao}, {data} (no fuso da cliente, com a hora de Lisboa ao lado), {link}.",
        showIf: { key: "wa_booking_confirm", values: ["1"] },
      },
    ],
  },
  {
    id: "zoom",
    name: "Zoom",
    summary: "Link da videochamada enviado em cada agendamento.",
    testable: true,
    testLabel: "Testar credenciais",
    fields: [
      {
        key: "zoom_mode",
        label: "Como gerar o link da sessão",
        type: "select",
        default: "fixed",
        options: [
          { value: "api", label: "Criar uma reunião Zoom por agendamento (API)" },
          { value: "fixed", label: "Usar sempre a mesma sala (link fixo)" },
          { value: "off", label: "Sem link automático" },
        ],
      },
      {
        key: "zoom_account_id",
        label: "Account ID",
        type: "text",
        env: "ZOOM_ACCOUNT_ID",
        help: "marketplace.zoom.us → Develop → Build App → Server-to-Server OAuth. Scope: meeting:write:meeting:admin.",
        showIf: { key: "zoom_mode", values: ["api"] },
      },
      { key: "zoom_client_id", label: "Client ID", type: "text", env: "ZOOM_CLIENT_ID", showIf: { key: "zoom_mode", values: ["api"] } },
      { key: "zoom_client_secret", label: "Client secret", type: "secret", env: "ZOOM_CLIENT_SECRET", showIf: { key: "zoom_mode", values: ["api"] } },
      {
        key: "zoom_fixed_url",
        label: "Link da sala",
        type: "url",
        placeholder: "https://zoom.us/j/1234567890?pwd=…",
        help: "Sala pessoal do Zoom, Google Meet ou outra. No modo API, é usado se a criação falhar.",
        showIf: { key: "zoom_mode", values: ["fixed", "api"] },
      },
    ],
  },
  {
    id: "calendar",
    name: "Google Calendar",
    summary: "Agendamentos no seu calendário e bloqueio de horários ocupados.",
    testable: true,
    testLabel: "Testar leitura do calendário",
    fields: [
      {
        key: "gcal_ical_url",
        label: "Endereço secreto em formato iCal",
        type: "secret",
        placeholder: "https://calendar.google.com/calendar/ical/…/private-…/basic.ics",
        help: "Google Calendar → Definições → o seu calendário → “Endereço secreto em formato iCal”. Os eventos ocupados deixam de aparecer como horários livres.",
      },
      { key: "gcal_block_busy", label: "Bloquear horários ocupados no Google Calendar", type: "toggle", default: "1" },
      {
        key: "gcal_sync_minutes",
        label: "Sincronizar a cada",
        type: "select",
        default: "5",
        options: [
          { value: "1", label: "1 minuto" },
          { value: "5", label: "5 minutos" },
          { value: "15", label: "15 minutos" },
          { value: "30", label: "30 minutos" },
          { value: "60", label: "1 hora" },
        ],
        help: "De quanto em quanto tempo a plataforma relê o seu Google Calendar. Na Agenda há também o botão “Sincronizar agora”.",
      },
    ],
  },
  {
    id: "hotmart",
    name: "Hotmart",
    summary: "Vendas, reembolsos e cancelamentos entram no CRM e no Financeiro.",
    fields: [
      {
        key: "hotmart_hottok",
        label: "Hottok de verificação",
        type: "secret",
        env: "HOTMART_HOTTOK",
        help: "Hotmart → Ferramentas → Webhooks → Hottok. Pedidos sem este token são recusados.",
      },
      { key: "hotmart_tags", label: "Etiquetar compradores e leads automaticamente", type: "toggle", default: "1" },
    ],
  },
  {
    id: "agendamento",
    name: "Agendamento",
    summary: "Regras da página pública de marcações.",
    fields: [
      {
        key: "booking_notice_hours",
        label: "Antecedência mínima (horas)",
        type: "number",
        default: "1",
        min: 0,
        max: 168,
        help: "Não é possível marcar com menos antecedência do que esta.",
      },
      {
        key: "booking_buffer_min",
        label: "Intervalo entre sessões (minutos)",
        type: "number",
        default: "15",
        min: 0,
        max: 120,
      },
      {
        key: "booking_window_days",
        label: "Marcações até quantos dias à frente",
        type: "number",
        default: "21",
        min: 1,
        max: 120,
      },
    ],
  },
];

export const SERVICE_IDS = SERVICES.map((s) => s.id);
export const getService = (id: string) => SERVICES.find((s) => s.id === id);
