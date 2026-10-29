/** Constantes do financeiro sem dependências de servidor (usadas também nos formulários). */

/** Categorias de despesa, com cor para os gráficos. */
export const EXPENSE_CATEGORIES: Record<string, string> = {
  "Software & ferramentas": "#6366f1",
  "Marketing & publicidade": "#ec4899",
  Impostos: "#ef4444",
  "Contabilidade & serviços": "#0ea5e9",
  "Equipamento": "#14b8a6",
  "Formação": "#f59e0b",
  "Espaço & deslocações": "#84cc16",
  "Taxas (Hotmart, banco)": "#a855f7",
  Outros: "#71717a",
};

export const PERIODS = {
  mes: "Este mês",
  "mes-anterior": "Mês anterior",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  tudo: "Tudo",
} as const;
export type PeriodKey = keyof typeof PERIODS;

