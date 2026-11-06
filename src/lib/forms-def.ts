/**
 * Formulários de captação de leads: tipos de campo, validação da construção e das respostas.
 * Partilhado entre o editor do backoffice, a página pública e o servidor.
 */

export type FieldType = "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "checkbox" | "consent";

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  help: string;
  required: boolean;
  width: "full" | "half";
  options: string[];
};

export type FormAnswer = { id: string; label: string; value: string };

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "Email extra" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista de opções" },
  { value: "radio", label: "Escolha única" },
  { value: "checkbox", label: "Várias escolhas" },
  { value: "consent", label: "Consentimento" },
];

/** Nome e email são os campos que criam o contacto: mudam de texto, mas não saem do formulário. */
export const LOCKED_FIELDS = ["name", "email"];
export const hasOptions = (t: FieldType) => t === "select" || t === "radio" || t === "checkbox";

export const SUBMISSION_STATUS: Record<string, string> = { new: "Por ler", read: "Lidas", archived: "Arquivadas" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELDS = 40;

export const blankField = (type: FieldType): FormField => ({
  id: `c${Math.random().toString(36).slice(2, 10)}`,
  type,
  label: type === "consent" ? "Autorizo o contacto e o tratamento destes dados." : (FIELD_TYPES.find((t) => t.value === type)?.label ?? "Pergunta"),
  placeholder: "",
  help: "",
  required: type === "consent",
  width: "full",
  options: hasOptions(type) ? ["Opção 1", "Opção 2"] : [],
});

const base = (o: Partial<FormField> & Pick<FormField, "id" | "type" | "label">): FormField => ({
  placeholder: "",
  help: "",
  required: false,
  width: "full",
  options: [],
  ...o,
});

export const nameField = () => base({ id: "name", type: "text", label: "Nome", placeholder: "O seu nome", required: true, width: "half" });
export const emailField = () => base({ id: "email", type: "email", label: "Email", placeholder: "voce@email.com", required: true, width: "half" });

export function starterFields(): FormField[] {
  return [
    nameField(),
    emailField(),
    base({ id: "phone", type: "phone", label: "Telefone / WhatsApp", placeholder: "+351 ...", width: "full" }),
    base({ id: "message", type: "textarea", label: "Mensagem", placeholder: "Conte-me um pouco mais..." }),
  ];
}

/** Formulário da página Contacto, com os assuntos que estavam escritos no Site. */
export function contactFields(subjects: string[]): FormField[] {
  return [
    nameField(),
    emailField(),
    base({ id: "phone", type: "phone", label: "Telefone / WhatsApp", placeholder: "+351 ...", width: "half" }),
    base({ id: "subject", type: "select", label: "Assunto", width: "half", options: subjects }),
    base({ id: "message", type: "textarea", label: "Mensagem", placeholder: "Conte-me onde está e onde quer chegar..." }),
  ];
}

export function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const formPath = (f: { key: string | null; slug: string }) => (f.key === "contato" ? "/contato" : `/formulario/${f.slug}`);

/** Limpa o que vem do editor. Devolve o erro em texto se o formulário não puder ser guardado. */
export function cleanFields(raw: unknown): { fields: FormField[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length > MAX_FIELDS) return { error: `Um formulário pode ter até ${MAX_FIELDS} campos.` };
  const seen = new Set<string>();
  const fields: FormField[] = [];
  for (const r of raw as Partial<FormField>[]) {
    const id = String(r?.id ?? "");
    const type = FIELD_TYPES.some((t) => t.value === r?.type) ? (r.type as FieldType) : null;
    const label = String(r?.label ?? "").trim().slice(0, 300);
    if (!/^[a-z0-9_-]{1,24}$/i.test(id) || seen.has(id) || !type) return { error: "Há um campo inválido. Recarregue a página e tente de novo." };
    if (!label) return { error: "Todos os campos precisam de um título." };
    seen.add(id);
    const options = hasOptions(type)
      ? [...new Set((Array.isArray(r.options) ? r.options : []).map((o) => String(o).trim().slice(0, 150)).filter(Boolean))].slice(0, 50)
      : [];
    if (hasOptions(type) && !options.length) return { error: `“${label}” precisa de pelo menos uma opção.` };
    fields.push({
      id,
      type,
      label,
      placeholder: String(r.placeholder ?? "").trim().slice(0, 150),
      help: String(r.help ?? "").trim().slice(0, 300),
      required: !!r.required,
      width: r.width === "half" && type !== "consent" ? "half" : "full",
      options,
    });
  }
  for (const id of LOCKED_FIELDS) {
    const f = fields.find((x) => x.id === id);
    if (!f) return { error: "O nome e o email têm de ficar no formulário." };
    f.required = true;
    f.type = id === "email" ? "email" : "text";
  }
  return { fields };
}

/** Valida uma resposta. `get` devolve os valores enviados para esse campo. */
export function readAnswers(fields: FormField[], get: (id: string) => string[]) {
  const answers: FormAnswer[] = [];
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const values = get(f.id).map((v) => v.trim()).filter(Boolean);
    const first = (values[0] ?? "").slice(0, f.type === "textarea" ? 5000 : 500);
    if (!values.length) {
      if (f.required) errors[f.id] = f.type === "consent" ? "Precisamos da sua autorização para continuar." : "Preencha este campo.";
      continue;
    }
    let value = first;
    if (f.type === "email" && !EMAIL_RE.test(first)) errors[f.id] = "Email inválido.";
    else if (f.type === "phone" && !/^[+()\d\s.-]{6,25}$/.test(first)) errors[f.id] = "Telefone inválido.";
    else if (f.type === "number" && !Number.isFinite(Number(first))) errors[f.id] = "Indique um número.";
    else if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(first)) errors[f.id] = "Data inválida.";
    else if ((f.type === "select" || f.type === "radio") && !f.options.includes(first)) errors[f.id] = "Escolha uma das opções.";
    else if (f.type === "checkbox") {
      const picked = values.filter((v) => f.options.includes(v));
      if (!picked.length) errors[f.id] = "Escolha uma das opções.";
      value = picked.join(", ");
    } else if (f.type === "consent") value = "Sim";
    if (!errors[f.id]) answers.push({ id: f.id, label: f.label, value });
  }
  return { answers, errors };
}
