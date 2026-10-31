/**
 * Formato das notas (partilhado entre servidor e browser). Cada linha do corpo é um bloco:
 *   "# Título", "## Cabeçalho", "- lista", "- [ ] tarefa", "- [x] tarefa feita" ou texto normal.
 * As #etiquetas podem aparecer em qualquer linha.
 */

export type BlockType = "title" | "heading" | "text" | "bullet" | "check";
export type Block = { id: string; type: BlockType; text: string; done?: boolean };

export const TRASH_DAYS = 30;

let seq = 0;
export const blockId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function parseNote(body: string): Block[] {
  if (!body.trim()) return [{ id: blockId(), type: "title", text: "" }]; // nota nova: começa pelo título
  const lines = body.split("\n");
  const blocks = lines.map((line): Block => {
    const id = blockId();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^- \[( |x|X)\] ?(.*)$/))) return { id, type: "check", text: m[2], done: m[1] !== " " };
    if ((m = line.match(/^- (.*)$/))) return { id, type: "bullet", text: m[1] };
    if ((m = line.match(/^## (.*)$/))) return { id, type: "heading", text: m[1] };
    if ((m = line.match(/^# (.*)$/))) return { id, type: "title", text: m[1] };
    return { id, type: "text", text: line };
  });
  return blocks;
}

export function serializeNote(blocks: Block[]): string {
  if (blocks.every((b) => !b.text.trim())) return "";
  return blocks
    .map((b) => {
      const text = b.text.replace(/\n/g, " ");
      if (b.type === "check") return `- [${b.done ? "x" : " "}] ${text}`;
      if (b.type === "bullet") return `- ${text}`;
      if (b.type === "heading") return `## ${text}`;
      if (b.type === "title") return `# ${text}`;
      return text;
    })
    .join("\n")
    .replace(/\n+$/, "");
}

/** Texto de uma linha, sem as marcas. */
const plain = (line: string) =>
  line
    .replace(/^- \[( |x|X)\] ?/, "")
    .replace(/^- /, "")
    .replace(/^#{1,2} /, "")
    .trim();

/** Como nas Notas da Apple: o título é a primeira linha com texto. */
export function noteTitle(body: string) {
  for (const line of body.split("\n")) {
    const t = plain(line);
    if (t) return t.slice(0, 140);
  }
  return "";
}

/** As linhas depois do título, para a pré-visualização na lista. */
export function notePreview(body: string) {
  const lines = body.split("\n").map(plain).filter(Boolean);
  return lines.slice(1).join(" · ").slice(0, 160);
}

export function noteTasks(body: string) {
  let open = 0;
  let done = 0;
  for (const line of body.split("\n")) {
    const m = line.match(/^- \[( |x|X)\]/);
    if (m) {
      if (m[1] === " ") open++;
      else done++;
    }
  }
  return { open, done };
}

/** #etiquetas da nota, em minúsculas e sem repetidas. Ignora "#" de títulos e números (#1). */
export function noteTags(body: string) {
  const found = new Set<string>();
  for (const m of body.matchAll(/(?:^|[\s(])#([\p{L}][\p{L}\p{N}_-]{0,39})/gu)) found.add(m[1].toLowerCase());
  return [...found];
}

/** As tarefas por fazer de uma nota, com o número da linha para as poder marcar. */
export function openTaskLines(body: string) {
  return body
    .split("\n")
    .map((line, i) => ({ i, m: line.match(/^- \[ \] ?(.*)$/) }))
    .filter((r): r is { i: number; m: RegExpMatchArray } => Boolean(r.m && r.m[1].trim()))
    .map(({ i, m }) => ({ line: i, text: m[1].trim() }));
}

/** Marca (ou desmarca) a tarefa da linha indicada. */
export function toggleTaskLine(body: string, line: number) {
  const lines = body.split("\n");
  const l = lines[line] ?? "";
  if (/^- \[ \]/.test(l)) lines[line] = l.replace(/^- \[ \]/, "- [x]");
  else if (/^- \[(x|X)\]/.test(l)) lines[line] = l.replace(/^- \[(x|X)\]/, "- [ ]");
  return lines.join("\n");
}
