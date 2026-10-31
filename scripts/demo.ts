/**
 * Dados fictícios para demonstração: contactos, pipeline, pagamentos, despesas, agenda, cursos
 * (com módulos, aulas, quizzes e materiais), alunas, marketing, WhatsApp e estatísticas da bio.
 *
 * Só acrescenta — não apaga nem altera o que já existe. Guarda os ids criados na definição
 * "demo_ids", para poderem ser removidos de uma vez:
 *
 *   npm run db:demo            cria os dados
 *   npm run db:demo -- --remover   apaga tudo o que foi criado por este script
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  agendaEvents,
  appointments,
  bioEvents,
  bioLinks,
  channels,
  contacts,
  contactTags,
  courseFiles,
  courses,
  deals,
  enrollments,
  eventTypes,
  expenses,
  interactions,
  lessonProgress,
  lessons,
  modules,
  payments,
  pipelineStages,
  posts,
  quizQuestions,
  settings,
  tags,
  users,
  whatsappMessages,
} from "../src/db/schema";
import { inferFromPhone } from "../src/lib/timezones";

const KEY = "demo_ids";
type Ids = Record<string, number[]>;
type Stored = { ids: Ids; files: string[]; at: string };

/* --------------------------- aleatório previsível --------------------------- */

let seed = 20261031;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

/* --------------------------------- datas ---------------------------------- */

const at = (dayOffset: number, h = 10, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};
const ago = (days: number, h = 12) => at(-days, h, int(0, 3) * 15);
/** Dia útil (seg–sex) mais próximo, para a agenda não cair ao fim de semana. */
const weekday = (dayOffset: number, h: number, m = 0) => {
  const d = at(dayOffset, h, m);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + (dayOffset >= 0 ? 1 : -1));
  return d;
};

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

/** PDF de uma página, só com texto — chega para os materiais de exemplo. */
function makePdf(title: string, lines: string[]) {
  const esc = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7e]/g, "-")
      .replace(/([\\()])/g, "\\$1");
  const body = [
    "BT /F1 22 Tf 60 770 Td",
    `(${esc(title)}) Tj`,
    "/F1 11 Tf 0 -34 Td 16 TL",
    ...lines.map((l) => `(${esc(l)}) '`),
    "0 -40 Td (Marina Loyola - material de exemplo) Tj ET",
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

const uploadsDir = path.join(process.cwd(), "uploads", "cursos");

/* --------------------------------- remover -------------------------------- */

async function remove() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (!row) {
    console.log("Não há dados de demonstração para remover.");
    return;
  }
  const { ids, files } = JSON.parse(row.value) as Stored;
  const del = async (label: string, table: Parameters<typeof db.delete>[0], col: Parameters<typeof inArray>[0]) => {
    const list = ids[label] ?? [];
    if (list.length) await db.delete(table).where(inArray(col, list));
    console.log(`✓ ${label}: ${list.length}`);
  };
  // Filhos primeiro; o resto sai em cascata com os contactos, cursos e alunas
  await del("bioEvents", bioEvents, bioEvents.id);
  await del("posts", posts, posts.id);
  await del("agendaEvents", agendaEvents, agendaEvents.id);
  await del("appointments", appointments, appointments.id);
  await del("expenses", expenses, expenses.id);
  await del("courses", courses, courses.id);
  await del("users", users, users.id);
  await del("contacts", contacts, contacts.id);
  await del("tags", tags, tags.id);
  await del("channels", channels, channels.id);
  await del("bioLinks", bioLinks, bioLinks.id);
  for (const f of files) await fs.rm(path.join(uploadsDir, path.basename(f)), { force: true });
  await db.delete(settings).where(eq(settings.key, KEY));
  console.log(`\nDados de demonstração removidos (${files.length} ficheiros apagados).`);
}

/* ---------------------------------- criar --------------------------------- */

async function create() {
  const [exists] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (exists) {
    console.log("Os dados de demonstração já existem. Para recriar: npm run db:demo -- --remover");
    return;
  }

  const ids: Ids = {};
  const files: string[] = [];
  const keep = <T extends { id: number }>(label: string, rows: T[]) => {
    (ids[label] ??= []).push(...rows.map((r) => r.id));
    return rows;
  };

  /* ---- estrutura existente (criada pelo db:init) ---- */
  const stages = await db.select().from(pipelineStages);
  if (!stages.length) throw new Error("Não há fases de pipeline. Corra primeiro: npm run db:deploy");
  const stageOf = (pipeline: string, order: number) =>
    stages.find((s) => s.pipeline === pipeline && s.order === order) ??
    stages.filter((s) => s.pipeline === pipeline).sort((a, b) => b.order - a.order)[0] ??
    stages[0];

  let types = await db.select().from(eventTypes);
  if (!types.length) {
    types = await db
      .insert(eventTypes)
      .values([
        { name: "Sessão Exploratória", durationMin: 30, color: "#a855f7" },
        { name: "Sessão de Mentoria", durationMin: 60, color: "#800080" },
      ])
      .returning();
  }
  const explor = types.find((t) => /explorat/i.test(t.name)) ?? types[0];
  const mentor = types.find((t) => /mentoria/i.test(t.name)) ?? types[types.length - 1];

  /* ---- canais e tags (só os que faltam) ---- */
  const channelDefs = [
    ["BNI", "#c8102e"],
    ["CNN", "#1d4ed8"],
    ["BNEX", "#0f766e"],
    ["Eventos & palestras", "#b45309"],
  ] as const;
  const haveCh = await db.select().from(channels);
  const newCh = channelDefs.filter(([n]) => !haveCh.some((c) => c.name === n));
  if (newCh.length) keep("channels", await db.insert(channels).values(newCh.map(([name, color]) => ({ name, color }))).returning());
  const allCh = await db.select().from(channels);
  const chId = (n: string) => allCh.find((c) => c.name === n)?.id ?? null;

  const tagDefs = [
    ["WhatsApp", "#25d366"],
    ["Cliente Hotmart", "#f97316"],
    ["Cliente Mentoria", "#800080"],
    ["Comprador Workshop", "#a855f7"],
    ["Newsletter — O Dossiê", "#0ea5e9"],
    ["Agendamento", "#6366f1"],
    ["VIP", "#eab308"],
    ["Contacto Site", "#71717a"],
  ] as const;
  const haveTags = await db.select().from(tags);
  const newTags = tagDefs.filter(([n]) => !haveTags.some((t) => t.name === n));
  if (newTags.length) keep("tags", await db.insert(tags).values(newTags.map(([name, color]) => ({ name, color }))).returning());
  const allTags = await db.select().from(tags);
  const tagId = (n: string) => allTags.find((t) => t.name === n)!.id;

  /* ---- contactos ---- */
  console.log("A criar contactos...");
  type S = "lead" | "qualified" | "negotiating" | "client" | "inactive" | "lost";
  type Src = "whatsapp" | "hotmart" | "site" | "social" | "referral" | "manual";
  const people: [string, string | null, string, Src, S, number, string | null, string[]][] = [
    ["Sofia Andrade", "+351 912 440 771", "Lisboa", "whatsapp", "client", 210, "BNI", ["WhatsApp", "Cliente Mentoria", "VIP"]],
    ["Inês Marques", "+351 965 220 318", "Porto", "hotmart", "client", 180, null, ["Cliente Hotmart", "Comprador Workshop"]],
    ["Beatriz Lemos", "+55 81 99455-7090", "Recife", "site", "qualified", 36, "CNN", ["Contacto Site"]],
    ["Carolina Peixoto", null, "Braga", "hotmart", "client", 120, null, ["Cliente Hotmart"]],
    ["Marta Saldanha", "+351 918 663 402", "Coimbra", "whatsapp", "negotiating", 21, "BNI", ["WhatsApp", "Agendamento"]],
    ["Joana Cerejo", null, "Faro", "site", "lead", 4, null, ["Newsletter — O Dossiê"]],
    ["Rita Batalha", "+55 21 99188-4233", "Rio de Janeiro", "referral", "client", 95, "BNI", ["Cliente Mentoria"]],
    ["Teresa Valente", "+44 7700 900123", "Londres", "social", "lead", 9, "Eventos & palestras", ["Newsletter — O Dossiê"]],
    ["Ana Costa Pinto", null, "Cascais", "hotmart", "lost", 150, null, []],
    ["Luísa Figueiredo", "+351 935 112 764", "Évora", "manual", "inactive", 130, "BNEX", []],
    ["Mariana Coutinho", "+55 11 98744-8209", "São Paulo", "whatsapp", "qualified", 13, "CNN", ["WhatsApp", "Agendamento"]],
    ["Diana Resende", null, "Viseu", "site", "lead", 2, null, ["Contacto Site"]],
    ["Helena Brito", "+351 913 778 120", "Lisboa", "referral", "client", 75, "BNI", ["Cliente Mentoria", "VIP"]],
    ["Catarina Moura", "+351 926 401 552", "Aveiro", "social", "negotiating", 17, null, ["Agendamento"]],
    ["Patrícia Gouveia", "+351 961 230 994", "Setúbal", "whatsapp", "qualified", 28, "BNEX", ["WhatsApp"]],
    ["Raquel Antunes", null, "Leiria", "hotmart", "client", 64, null, ["Cliente Hotmart", "Comprador Workshop"]],
    ["Vera Lacerda", "+33 6 12 34 56 78", "Paris", "social", "lead", 6, "Eventos & palestras", ["Newsletter — O Dossiê"]],
    ["Filipa Rocha", "+351 917 552 031", "Sintra", "site", "client", 48, null, ["Comprador Workshop"]],
    ["Camila Duarte", "+55 31 98877-1203", "Belo Horizonte", "hotmart", "client", 88, null, ["Cliente Hotmart"]],
    ["Leonor Tavares", "+351 934 019 777", "Lisboa", "referral", "negotiating", 11, "BNI", ["Agendamento"]],
    ["Madalena Freitas", null, "Porto", "site", "lead", 1, null, ["Contacto Site"]],
    ["Bruna Sales", "+55 41 99652-3310", "Curitiba", "whatsapp", "qualified", 19, "CNN", ["WhatsApp"]],
    ["Joana Matos", "+351 968 330 145", "Guimarães", "hotmart", "client", 140, null, ["Cliente Hotmart", "Comprador Workshop"]],
    ["Sara Monteiro", "+41 79 123 45 67", "Genebra", "social", "lead", 15, null, []],
    ["Íris Carvalho", "+351 912 663 810", "Funchal", "whatsapp", "client", 57, "BNEX", ["WhatsApp", "Cliente Mentoria"]],
    ["Margarida Pires", null, "Ponta Delgada", "site", "inactive", 160, null, ["Newsletter — O Dossiê"]],
    ["Alice Nogueira", "+351 925 884 230", "Lisboa", "manual", "lost", 70, "Eventos & palestras", []],
    ["Gabriela Lins", "+55 85 99123-5567", "Fortaleza", "hotmart", "client", 33, null, ["Cliente Hotmart"]],
    ["Clara Sampaio", "+351 919 220 447", "Oeiras", "referral", "qualified", 8, "BNI", ["Agendamento"]],
    ["Lara Fonseca", null, "Covilhã", "site", "lead", 3, null, ["Newsletter — O Dossiê"]],
    ["Mónica Teixeira", "+351 936 772 509", "Matosinhos", "whatsapp", "negotiating", 24, "BNEX", ["WhatsApp"]],
    ["Eduarda Reis", "+55 51 98432-7766", "Porto Alegre", "social", "lead", 5, null, []],
    ["Constança Vaz", "+351 914 552 300", "Cascais", "referral", "client", 112, "BNI", ["Cliente Mentoria", "VIP"]],
    ["Yasmin Barros", "+55 71 99210-4455", "Salvador", "hotmart", "client", 42, null, ["Cliente Hotmart", "Comprador Workshop"]],
    ["Teresa Quintela", "+351 963 118 274", "Braga", "site", "qualified", 26, null, ["Contacto Site"]],
    ["Rosa Almeida", "+1 415 555 0142", "São Francisco", "social", "lead", 12, "Eventos & palestras", ["Newsletter — O Dossiê"]],
  ];
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]+/g, ".");
  const contactRows = keep(
    "contacts",
    await db
      .insert(contacts)
      .values(
        people.map(([name, phone, location, source, status, days, ch]) => {
          const locale = inferFromPhone(phone) ?? { country: "PT", timezone: "Europe/Lisbon" };
          return {
            name,
            email: `${slug(name)}@exemplo.pt`,
            phone,
            location,
            source,
            status,
            ...locale,
            channelId: ch ? chId(ch) : null,
            referredBy: ch === "BNI" ? pick(["Paula Reis (BNI Lisboa Centro)", "Sofia Andrade", "Nuno Esteves (BNI Porto)"]) : null,
            notes: status === "client" ? "Cliente de demonstração." : null,
            createdAt: ago(days, int(9, 19)),
          };
        })
      )
      .returning()
  );
  const C = (name: string) => contactRows.find((c) => c.name === name)!;

  await db.insert(contactTags).values(
    people.flatMap(([name, , , , , , , tg]) => tg.map((t) => ({ contactId: C(name).id, tagId: tagId(t) })))
  );

  /* ---- interações ---- */
  const notes: [string, string, string, number][] = [
    ["Sofia Andrade", "whatsapp", "Primeiro contacto via WhatsApp: queria perceber se a mentoria servia para o seu estúdio.", 210],
    ["Sofia Andrade", "booking", "Sessão 12 concluída. Plano de 90 dias entregue.", 6],
    ["Inês Marques", "note", "Pediu certificado do workshop. Emitido.", 160],
    ["Marta Saldanha", "whatsapp", "Muito interessada na mentoria. Enviada proposta em PDF.", 8],
    ["Marta Saldanha", "booking", "Agendou Sessão Exploratória.", 2],
    ["Beatriz Lemos", "note", "Formulário do site: quer rebranding do estúdio antes de subir preços.", 36],
    ["Beatriz Lemos", "email", "Enviada proposta de mentoria faseada (3 × 620 €).", 12],
    ["Helena Brito", "note", "Indicada pela Sofia. Fechou mentoria em 2 parcelas.", 70],
    ["Catarina Moura", "email", "Pediu exemplos de antes/depois. Enviado o case do Estúdio Meridional.", 9],
    ["Leonor Tavares", "booking", "Sessão exploratória correu muito bem — decide até sexta.", 4],
    ["Mónica Teixeira", "whatsapp", "Perguntou se dá para pagar em 3 vezes. Respondido que sim.", 3],
    ["Clara Sampaio", "note", "Conheceu a Marina numa reunião do BNI. Quer workshop para a equipa.", 8],
    ["Ana Costa Pinto", "purchase", "Reembolso do curso processado na Hotmart.", 145],
    ["Alice Nogueira", "note", "Optou por adiar para o próximo ano (orçamento).", 40],
    ["Diana Resende", "note", "Novo lead do site — pediu informações sobre workshops.", 2],
    ["Constança Vaz", "note", "Renovou para mais 3 meses de acompanhamento.", 20],
  ];
  await db.insert(interactions).values(
    notes.map(([n, type, content, d]) => ({ contactId: C(n).id, type, content, createdAt: ago(d, int(9, 18)) }))
  );

  /* ---- pipeline ---- */
  console.log("A criar negócios...");
  const dealDefs: [string, string, number, string, string, number, ("open" | "won" | "lost")?, string?][] = [
    ["Diana Resende", "mentoria", 1, "Interesse em mentoria", "Mentoria Design Business", 1800],
    ["Lara Fonseca", "mentoria", 1, "Lead da newsletter", "Mentoria Design Business", 1800],
    ["Eduarda Reis", "mentoria", 2, "Respondeu ao story de bastidores", "Mentoria Design Business", 1800],
    ["Bruna Sales", "mentoria", 2, "Pediu valores por WhatsApp", "Mentoria Design Business", 1800],
    ["Mariana Coutinho", "mentoria", 3, "Pós-sessão exploratória", "Mentoria Design Business", 1800],
    ["Patrícia Gouveia", "mentoria", 3, "Qualificada — estúdio com 2 pessoas", "Mentoria Design Business", 1800],
    ["Teresa Quintela", "mentoria", 3, "Rebranding pessoal", "Mentoria Design Business", 1800],
    ["Beatriz Lemos", "mentoria", 4, "Rebranding + mentoria faseada", "Mentoria Design Business", 1860],
    ["Marta Saldanha", "mentoria", 4, "Proposta PDF enviada", "Mentoria Design Business", 1800],
    ["Catarina Moura", "mentoria", 4, "Proposta com bónus de auditoria", "Mentoria Design Business", 2100],
    ["Leonor Tavares", "mentoria", 4, "Decide até sexta", "Mentoria Design Business", 1800],
    ["Mónica Teixeira", "mentoria", 5, "Plano em 3 parcelas", "Mentoria Design Business", 1860],
    ["Helena Brito", "mentoria", 6, "Mentoria em curso (semana 6)", "Mentoria Design Business", 1800],
    ["Rita Batalha", "mentoria", 6, "Mentoria em curso (semana 10)", "Mentoria Design Business", 1800],
    ["Íris Carvalho", "mentoria", 6, "Mentoria em curso (semana 4)", "Mentoria Design Business", 1800],
    ["Sofia Andrade", "mentoria", 6, "Mentoria concluída", "Mentoria Design Business", 1800, "won"],
    ["Constança Vaz", "mentoria", 6, "Renovação 3 meses", "Acompanhamento trimestral", 900, "won"],
    ["Alice Nogueira", "mentoria", 4, "Adiou para o próximo ano", "Mentoria Design Business", 1800, "lost", "Orçamento"],
    ["Sara Monteiro", "mentoria", 3, "Escolheu outra mentora", "Mentoria Design Business", 1800, "lost", "Concorrência"],
    ["Clara Sampaio", "workshops", 1, "Workshop in-company (equipa de 6)", "Workshop — Marca Premium", 890],
    ["Teresa Valente", "workshops", 2, "Inscrição próxima edição", "Workshop — Marca Premium", 89],
    ["Vera Lacerda", "workshops", 2, "Inscrição próxima edição", "Workshop — Marca Premium", 89],
    ["Rosa Almeida", "workshops", 3, "Aguarda pagamento", "Workshop — Marca Premium", 89],
    ["Luísa Figueiredo", "workshops", 3, "Aguarda MB WAY", "Workshop — Marca Premium", 89],
    ["Filipa Rocha", "workshops", 4, "Confirmada edição de novembro", "Workshop — Marca Premium", 89],
    ["Yasmin Barros", "workshops", 4, "Confirmada edição de novembro", "Workshop — Marca Premium", 89],
    ["Inês Marques", "workshops", 5, "Workshop #7 concluído", "Workshop — Marca Premium", 89, "won"],
    ["Raquel Antunes", "workshops", 5, "Workshop #8 concluído", "Workshop — Marca Premium", 89, "won"],
  ];
  await db.insert(deals).values(
    dealDefs.map(([n, pipe, order, title, product, value, outcome = "open", lostReason]) => {
      const created = int(3, 60);
      return {
        contactId: C(n).id,
        stageId: stageOf(pipe, order).id,
        title,
        product,
        value: String(value),
        outcome,
        lostReason: lostReason ?? null,
        closedAt: outcome === "open" ? null : ago(int(1, created), 16),
        expectedClose: outcome === "open" ? at(int(3, 35), 12) : null,
        createdAt: ago(created),
        updatedAt: ago(int(0, Math.min(created, 10))),
      };
    })
  );

  /* ---- pagamentos (12 meses) ---- */
  console.log("A criar pagamentos...");
  type Pay = typeof payments.$inferInsert;
  const pay: Pay[] = [];
  const buyers = ["Inês Marques", "Carolina Peixoto", "Raquel Antunes", "Camila Duarte", "Joana Matos", "Gabriela Lins", "Yasmin Barros", "Filipa Rocha"];
  for (let m = 11; m >= 0; m--) {
    const sales = int(3, 7) + (11 - m) / 3;
    for (let i = 0; i < sales; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - m, int(1, 28));
      d.setHours(int(9, 21), int(0, 59), 0, 0);
      if (d > new Date()) continue;
      const curso = rnd() < 0.55;
      const status = rnd() < 0.06 ? "refunded" : "confirmed";
      pay.push({
        contactId: C(pick(buyers)).id,
        product: curso ? "Curso Identidade com Assinatura" : "Workshop — Marca Premium",
        amount: curso ? "197" : "89",
        method: "hotmart",
        status,
        reference: `HP${int(10000000, 99999999)}`,
        paidAt: status === "confirmed" ? d : null,
        createdAt: d,
      });
    }
  }
  // Mentorias (pagamento único ou parcelas)
  const mentorias: [string, number, number, "transfer" | "mbway"][] = [
    ["Sofia Andrade", 200, 1, "transfer"],
    ["Rita Batalha", 92, 2, "mbway"],
    ["Helena Brito", 72, 2, "transfer"],
    ["Íris Carvalho", 55, 3, "mbway"],
    ["Constança Vaz", 110, 1, "transfer"],
    ["Mónica Teixeira", 2, 3, "transfer"],
  ];
  for (const [n, days, parts, method] of mentorias) {
    const plan = parts > 1 ? crypto.randomUUID() : null;
    const total = n === "Constança Vaz" ? 2700 : n === "Mónica Teixeira" ? 1860 : 1800;
    for (let i = 0; i < parts; i++) {
      const due = ago(days - i * 30, 12);
      const paid = due <= new Date() && !(n === "Íris Carvalho" && i === 2);
      pay.push({
        contactId: C(n).id,
        product: "Mentoria Design Business",
        amount: String(Math.round((total / parts) * 100) / 100),
        method,
        status: paid ? "completed" : "pending",
        reference: paid ? `${method === "mbway" ? "MBW" : "TRF"}-${int(1000, 9999)}` : null,
        paidAt: paid ? due : null,
        dueDate: paid ? null : due,
        installment: plan ? i + 1 : null,
        installments: plan ? parts : null,
        planRef: plan,
        createdAt: ago(days, 11),
      });
    }
  }
  pay.push(
    { contactId: C("Mariana Coutinho").id, product: "Sessão Avulsa", amount: "120", method: "mbway", status: "completed", reference: "MBW-91447", paidAt: ago(12), createdAt: ago(12) },
    { contactId: C("Luísa Figueiredo").id, product: "Workshop — Marca Premium", amount: "89", method: "mbway", status: "pending", dueDate: ago(4), createdAt: ago(6) },
    { contactId: C("Rosa Almeida").id, product: "Workshop — Marca Premium", amount: "89", method: "transfer", status: "pending", dueDate: at(3, 12), createdAt: ago(2) },
    { contactId: C("Clara Sampaio").id, product: "Workshop in-company", amount: "890", method: "transfer", status: "pending", dueDate: at(10, 12), createdAt: ago(1) },
    { contactId: C("Ana Costa Pinto").id, product: "Curso Identidade com Assinatura", amount: "197", method: "hotmart", status: "refunded", createdAt: ago(150) },
    { contactId: C("Alice Nogueira").id, product: "Sessão Avulsa", amount: "120", method: "other", status: "cancelled", createdAt: ago(40) }
  );
  await db.insert(payments).values(pay);

  /* ---- despesas (12 meses) ---- */
  console.log("A criar despesas...");
  const monthly: [string, string, string, string][] = [
    ["Adobe Creative Cloud", "Software & ferramentas", "59.99", "Adobe"],
    ["Figma Professional", "Software & ferramentas", "15", "Figma"],
    ["Zoom Pro", "Software & ferramentas", "13.99", "Zoom"],
    ["Notion Plus", "Software & ferramentas", "9.5", "Notion"],
    ["Contabilista certificado", "Contabilidade & serviços", "120", "Gabinete Silva & Reis"],
    ["Cowork Lisboa — secretária fixa", "Espaço & deslocações", "180", "Second Home"],
  ];
  const oneOff: [string, string, number, number, string | null][] = [
    ["Anúncios Instagram — lançamento workshop", "Marketing & publicidade", 120, 320, "Meta"],
    ["Taxas Hotmart", "Taxas (Hotmart, banco)", 30, 90, "Hotmart"],
    ["Comissões bancárias", "Taxas (Hotmart, banco)", 4, 12, "Millennium BCP"],
    ["Fotografia de marca", "Marketing & publicidade", 250, 450, "Estúdio Luz"],
    ["Comboio Lisboa–Porto (workshop)", "Espaço & deslocações", 35, 70, "CP"],
  ];
  type Exp = typeof expenses.$inferInsert;
  const exp: Exp[] = [];
  for (let m = 11; m >= 0; m--) {
    const day = (d: number) => {
      const x = new Date();
      x.setMonth(x.getMonth() - m, Math.min(d, 28));
      x.setHours(10, 0, 0, 0);
      return x;
    };
    for (const [description, category, amount, supplier] of monthly) {
      const date = day(3 + (description.length % 8));
      if (date <= new Date()) exp.push({ description, category, amount, supplier, recurring: true, date });
    }
    for (const [description, category, min, max, supplier] of oneOff) {
      if (rnd() < 0.5) continue;
      const date = day(int(5, 27));
      if (date <= new Date()) exp.push({ description, category, amount: String(int(min, max)), supplier, date });
    }
    if (m % 3 === 1) exp.push({ description: "Segurança Social (trimestral)", category: "Impostos", amount: "345", date: day(20) });
  }
  exp.push(
    { description: "Monitor calibrado BenQ", category: "Equipamento", amount: "489", supplier: "Worten", date: ago(100) },
    { description: "Curso de copywriting", category: "Formação", amount: "149", date: ago(70) },
    { description: "Conferência Design Week", category: "Formação", amount: "220", supplier: "Lisbon Design Week", date: ago(25) },
    { description: "Material de papelaria para workshop", category: "Outros", amount: "64.3", supplier: "Papelaria Fernandes", date: ago(15) }
  );
  keep("expenses", await db.insert(expenses).values(exp).returning({ id: expenses.id }));

  /* ---- agenda ---- */
  console.log("A criar agenda...");
  const appt = (n: string, type: typeof explor, start: Date, status: "confirmed" | "cancelled" | "completed" = "confirmed") => {
    const c = C(n);
    return {
      eventTypeId: type.id,
      contactId: c.id,
      name: c.name,
      email: c.email!,
      phone: c.phone,
      timezone: c.timezone ?? "Europe/Lisbon",
      startAt: start,
      endAt: new Date(start.getTime() + type.durationMin * 60000),
      status,
      meetingUrl: `https://meet.google.com/${slug(n).slice(0, 3)}-demo-${int(100, 999)}`,
      notes: type === explor ? "Quer perceber se a mentoria é o passo certo." : null,
      createdAt: new Date(start.getTime() - int(2, 10) * 86400000),
    };
  };
  keep(
    "appointments",
    await db
      .insert(appointments)
      .values([
        appt("Marta Saldanha", explor, weekday(1, 10)),
        appt("Leonor Tavares", explor, weekday(1, 15, 30)),
        appt("Helena Brito", mentor, weekday(2, 11)),
        appt("Mariana Coutinho", mentor, weekday(2, 16)),
        appt("Rita Batalha", mentor, weekday(3, 14, 30)),
        appt("Clara Sampaio", explor, weekday(4, 9, 30)),
        appt("Íris Carvalho", mentor, weekday(5, 10)),
        appt("Catarina Moura", explor, weekday(6, 17)),
        appt("Bruna Sales", explor, weekday(8, 15)),
        appt("Helena Brito", mentor, weekday(9, 11)),
        appt("Patrícia Gouveia", explor, weekday(11, 10, 30)),
        appt("Íris Carvalho", mentor, weekday(12, 10)),
        appt("Rita Batalha", mentor, weekday(10, 14, 30)),
        appt("Sofia Andrade", mentor, weekday(-6, 10), "completed"),
        appt("Helena Brito", mentor, weekday(-5, 11), "completed"),
        appt("Rita Batalha", mentor, weekday(-4, 14, 30), "completed"),
        appt("Beatriz Lemos", explor, weekday(-20, 15), "completed"),
        appt("Mónica Teixeira", explor, weekday(-9, 16), "completed"),
        appt("Íris Carvalho", mentor, weekday(-2, 10), "completed"),
        appt("Alice Nogueira", explor, weekday(-3, 12), "cancelled"),
        appt("Constança Vaz", mentor, weekday(-12, 9, 30), "completed"),
      ])
      .returning({ id: appointments.id })
  );
  const ev = (title: string, start: Date, hours: number, extra: Partial<typeof agendaEvents.$inferInsert> = {}) => ({
    title,
    startAt: start,
    endAt: new Date(start.getTime() + hours * 3600000),
    ...extra,
  });
  const allDay = (dayOffset: number, days = 1) => {
    const s = at(dayOffset, 0);
    const e = at(dayOffset + days - 1, 23, 59);
    return { startAt: s, endAt: e, allDay: true };
  };
  keep(
    "agendaEvents",
    await db
      .insert(agendaEvents)
      .values([
        ev("Reunião BNI Lisboa Centro", weekday(1, 7, 30), 1.5, { location: "Hotel Tivoli, Lisboa", color: "#c8102e" }),
        ev("Gravação de Reels", weekday(3, 9), 2.5, { location: "Estúdio", color: "#ec4899", notes: "3 reels: tipografia, paleta, bastidores" }),
        ev("Contabilista — fecho do trimestre", weekday(4, 16), 1, { color: "#0ea5e9" }),
        ev("Dentista", weekday(7, 12), 1, { color: "#71717a" }),
        { title: "Workshop Marca Premium — edição de novembro", ...allDay(14, 3), color: "#800080", location: "Online (Zoom)", notes: "Três dias, 10h–13h." },
        { title: "Férias", ...allDay(40, 5), color: "#84cc16" },
        ev("Almoço com parceira (Estúdio Luz)", weekday(5, 13), 1.5, { blocksBooking: false, color: "#f59e0b", location: "Time Out Market" }),
        ev("Planeamento de conteúdos do mês", weekday(-3, 9, 30), 2, { color: "#6366f1" }),
        ev("Reunião BNI Lisboa Centro", weekday(-6, 7, 30), 1.5, { location: "Hotel Tivoli, Lisboa", color: "#c8102e" }),
        ev("Palestra: Marcas com assinatura", weekday(-10, 18), 2, { location: "Lisbon Design Week", color: "#b45309" }),
      ])
      .returning({ id: agendaEvents.id })
  );

  /* ---- WhatsApp ---- */
  console.log("A criar conversas de WhatsApp...");
  const convo: [string, number, [("in" | "out"), string][]][] = [
    ["Mónica Teixeira", 0, [["in", "Olá Marina! Vi o teu post sobre preços e fiquei a pensar na mentoria 😊"], ["out", "Olá Mónica! Que bom 🙌 Queres marcar uma sessão exploratória gratuita?"], ["in", "Sim! E dá para pagar em 3 vezes?"], ["out", "Dá sim, sem custos extra. Envio-te já o link para marcar."], ["in", "Perfeito, obrigada!"]]],
    ["Marta Saldanha", 1, [["out", "Olá Marta, envio em anexo a proposta que falámos."], ["in", "Recebi, vou ler com calma esta noite."], ["in", "Uma dúvida: as sessões ficam gravadas?"]]],
    ["Bruna Sales", 2, [["in", "Oi Marina, tudo bem? Quanto custa a mentoria?"], ["out", "Olá Bruna! Tudo ótimo. A mentoria são 12 semanas, 1.800 €. Posso explicar melhor numa chamada?"], ["in", "Pode ser, sexta à tarde?"]]],
    ["Helena Brito", 3, [["out", "Helena, lembrete da sessão de quinta às 11h ✨"], ["in", "Combinado! Levo o novo portfólio."]]],
    ["Patrícia Gouveia", 5, [["in", "Bom dia! Somos duas no estúdio, a mentoria funciona para equipas?"], ["out", "Bom dia Patrícia! Funciona sim — adapto as sessões às duas."]]],
    ["Sofia Andrade", 9, [["in", "Marina, subi os preços como combinámos e fechei 2 projetos esta semana!! 🎉"], ["out", "SOFIA! Que orgulho 🥹 Isto é só o começo."]]],
  ];
  const wa = convo.flatMap(([n, days, msgs]) =>
    msgs.map(([direction, body], i) => {
      const createdAt = ago(days, 10);
      createdAt.setMinutes(createdAt.getMinutes() + i * int(2, 25));
      const last = i === msgs.length - 1;
      return {
        contactId: C(n).id,
        direction,
        body,
        readAt: direction === "out" || !(last && days <= 2) ? createdAt : null,
        createdAt,
      };
    })
  );
  await db.insert(whatsappMessages).values(wa);

  /* ---- cursos, aulas, quizzes e materiais ---- */
  console.log("A criar cursos...");
  const V = [
    "https://videos.pexels.com/video-files/4347781/4347781-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/4347863/4347863-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/36518090/15484750_3840_2160_30fps.mp4",
  ];
  type LessonDef = { t: string; type: "video" | "material" | "quiz"; min: number; content: string; pdf?: string[]; quiz?: [string, string[], number, string][] };
  type CourseDef = { title: string; slug: string; subtitle: string; description: string; cover: string; level: string; price: string; mods: [string, LessonDef[]][] };
  const quizBrand: [string, string[], number, string][] = [
    ["O que distingue uma marca premium?", ["Usar dourado", "Coerência entre posicionamento, linguagem e experiência", "Logótipo complexo", "Publicar todos os dias"], 1, "Premium é percepção construída com coerência."],
    ["O primeiro passo de um projeto de identidade é:", ["Escolher a tipografia", "Moodboard no Pinterest", "Diagnóstico e estratégia", "Três propostas de logo"], 2, "Sem diagnóstico, as decisões visuais não têm critério."],
    ["Numa paleta 60/30/10, o 10% é:", ["A cor de fundo", "A cor secundária", "A cor de destaque", "O preto do texto"], 2, "O destaque guia a atenção."],
    ["O posicionamento responde a:", ["Que cores usar", "Para quem é, que promessa faz e porque é diferente", "Quanto custa", "Em que redes estar"], 1, "Audiência, promessa e diferenciação."],
    ["Um guia de voz define:", ["Só o slogan", "Personalidade, tom e o que a marca nunca diz", "As hashtags", "O tamanho do logo"], 1, "O guia orienta toda a comunicação escrita."],
    ["Porque se mostram mockups na apresentação?", ["Para encher slides", "Para o cliente ver o sistema no seu contexto", "É obrigatório", "Para esconder o logo"], 1, "Ver a marca aplicada dá confiança."],
  ];
  const quizPrice: [string, string[], number, string][] = [
    ["Preço baseado em valor considera sobretudo:", ["As horas gastas", "O impacto do projeto para o cliente", "O preço da concorrência", "O custo do software"], 1, "O valor percebido justifica o preço."],
    ["Ancoragem de preço significa:", ["Baixar o preço no fim", "Mostrar primeiro uma opção mais alta", "Nunca falar de preço", "Dar desconto a todos"], 1, "A primeira referência influencia a decisão."],
    ["Quantos pacotes é boa prática apresentar?", ["1", "3", "7", "10"], 1, "Três opções facilitam a escolha."],
    ["Um bom follow-up de proposta é enviado:", ["Nunca", "No mesmo minuto", "Em 2–3 dias, com valor acrescentado", "Só depois de um mês"], 2, "Follow-up oportuno e útil."],
  ];
  const courseDefs: CourseDef[] = [
    {
      title: "Branding Estratégico para Designers",
      slug: "demo-branding-estrategico",
      subtitle: "Curso online",
      description: "Do briefing ao manual de marca: o processo completo para criar identidades com estratégia, consistência e valor percebido.",
      cover: "/img/curso-marca.jpg",
      level: "Intermédio",
      price: "247",
      mods: [
        ["Estratégia antes do design", [
          { t: "Boas-vindas e como estudar", type: "video", min: 7, content: "Apresentação do curso, materiais e ritmo sugerido de estudo." },
          { t: "Briefing que revela o que o cliente não diz", type: "video", min: 26, content: "As 12 perguntas do briefing estratégico e como conduzir a conversa." },
          { t: "Template de briefing estratégico", type: "material", min: 12, content: "Descarregue o template e use-o na próxima reunião com cliente.", pdf: ["1. Contexto do negócio", "2. Audiência principal", "3. Promessa e diferenciação", "4. Concorrentes e referências", "5. Objetivos a 12 meses"] },
          { t: "Quiz — Estratégia", type: "quiz", min: 8, content: "4 questões sorteadas. Nota mínima 60%.", quiz: quizBrand },
        ]],
        ["Sistema visual", [
          { t: "Tipografia com personalidade", type: "video", min: 31, content: "Combinar famílias tipográficas que carregam a voz da marca." },
          { t: "Paleta funcional 60/30/10", type: "video", min: 22, content: "Construir uma paleta com contraste, acessibilidade e flexibilidade." },
          { t: "Checklist do sistema visual", type: "material", min: 10, content: "Checklist para validar o sistema antes da apresentação.", pdf: ["Logótipo principal e variações", "Paleta com códigos HEX/CMYK", "Pares tipográficos", "Grelha e espaçamentos", "Iconografia e padrões"] },
        ]],
        ["Apresentação e entrega", [
          { t: "A apresentação que fecha contratos", type: "video", min: 28, content: "Narrativa: contexto, decisões, sistema e aplicação real." },
          { t: "Manual de marca que o cliente usa", type: "material", min: 15, content: "Estrutura de manual prático, em PDF.", pdf: ["Introdução e propósito", "Uso do logótipo", "Cores e tipografia", "Aplicações", "O que nunca fazer"] },
        ]],
      ],
    },
    {
      title: "Precificação Premium",
      slug: "demo-precificacao-premium",
      subtitle: "Mini-curso",
      description: "Como calcular, apresentar e defender preços premium sem hesitar — com scripts, pacotes e propostas prontas.",
      cover: "/img/curso-workshop.jpg",
      level: "Todos os níveis",
      price: "97",
      mods: [
        ["Calcular", [
          { t: "Porque cobrar à hora te prende", type: "video", min: 18, content: "Do preço por hora ao preço por valor." },
          { t: "Calculadora de preço mínimo", type: "material", min: 10, content: "Folha de cálculo para descobrir o seu preço mínimo sustentável.", pdf: ["Custos fixos mensais", "Horas faturáveis reais", "Margem de lucro desejada", "Impostos e taxas", "Preço mínimo por projeto"] },
        ]],
        ["Apresentar e defender", [
          { t: "Três pacotes e ancoragem", type: "video", min: 24, content: "Estruturar pacotes que guiam a decisão." },
          { t: "Scripts para objeções de preço", type: "material", min: 12, content: "Respostas para \"está caro\", \"vou pensar\" e \"outro faz por menos\".", pdf: ["\"Está caro\" - reenquadrar no resultado", "\"Vou pensar\" - perguntar o que falta", "\"Outro faz por menos\" - comparar o que está incluído"] },
          { t: "Quiz — Preço", type: "quiz", min: 6, content: "Teste rápido sobre precificação.", quiz: quizPrice },
        ]],
      ],
    },
    {
      title: "Instagram para Designers",
      slug: "demo-instagram-designers",
      subtitle: "Curso online · em breve",
      description: "Calendário editorial, formatos que convertem e um sistema de produção de conteúdo em 4 horas por semana.",
      cover: "/img/curso-mentoria.jpg",
      level: "Iniciante",
      price: "127",
      mods: [
        ["Estratégia de conteúdo", [
          { t: "Os 4 pilares de conteúdo", type: "video", min: 19, content: "Autoridade, bastidores, prova e convite." },
          { t: "Calendário editorial de 30 dias", type: "material", min: 10, content: "Modelo de calendário pronto a preencher.", pdf: ["Semana 1 - autoridade", "Semana 2 - bastidores", "Semana 3 - prova social", "Semana 4 - convite / oferta"] },
        ]],
      ],
    },
  ];

  const courseRows = keep(
    "courses",
    await db
      .insert(courses)
      .values(courseDefs.map(({ mods, ...c }, i) => ({ ...c, published: i < 2, hotmartUrl: `https://pay.hotmart.com/${c.slug}`, createdAt: ago(200 - i * 60) })))
      .returning()
  );

  await fs.mkdir(uploadsDir, { recursive: true });
  const lessonIdsByCourse = new Map<number, number[]>();
  for (const [ci, def] of courseDefs.entries()) {
    const course = courseRows[ci];
    const all: number[] = [];
    for (const [mi, [mTitle, ls]] of def.mods.entries()) {
      const [mod] = await db.insert(modules).values({ courseId: course.id, title: mTitle, order: mi + 1 }).returning();
      for (const [li, l] of ls.entries()) {
        const [lesson] = await db
          .insert(lessons)
          .values({
            moduleId: mod.id,
            title: l.t,
            order: li + 1,
            type: l.type,
            durationMin: l.min,
            videoUrl: l.type === "video" ? V[(mi + li) % V.length] : null,
            content: l.content,
            quizDraw: l.quiz ? Math.min(4, l.quiz.length) : null,
            quizMinScore: 60,
          })
          .returning();
        all.push(lesson.id);
        if (l.quiz) {
          await db.insert(quizQuestions).values(
            l.quiz.map(([question, options, answer, explanation], i) => ({ lessonId: lesson.id, question, options, answer, explanation, order: i + 1 }))
          );
        }
        if (l.pdf) {
          const buf = makePdf(l.t, l.pdf);
          const stored = `${crypto.randomUUID()}.pdf`;
          await fs.writeFile(path.join(uploadsDir, stored), buf);
          files.push(stored);
          await db.insert(courseFiles).values({
            courseId: course.id,
            lessonId: lesson.id,
            name: `${slug(l.t).replace(/\./g, "-")}.pdf`,
            storedName: stored,
            mime: "application/pdf",
            size: buf.length,
            downloads: int(0, 40),
          });
        }
      }
    }
    // Um ficheiro geral do curso (sem aula)
    const buf = makePdf(`${def.title} - guia do curso`, ["Bem-vinda!", "Neste guia: estrutura, prazos sugeridos e como tirar dúvidas.", "Reserve 2 horas por semana para estudar."]);
    const stored = `${crypto.randomUUID()}.pdf`;
    await fs.writeFile(path.join(uploadsDir, stored), buf);
    files.push(stored);
    await db.insert(courseFiles).values({ courseId: course.id, name: "guia-do-curso.pdf", storedName: stored, mime: "application/pdf", size: buf.length, downloads: int(5, 60) });
    lessonIdsByCourse.set(course.id, all);
  }

  /* ---- alunas, inscrições e progresso ---- */
  console.log("A criar alunas...");
  const students = ["Inês Marques", "Carolina Peixoto", "Raquel Antunes", "Camila Duarte", "Joana Matos", "Gabriela Lins", "Yasmin Barros", "Filipa Rocha", "Sofia Andrade", "Helena Brito"];
  const pw = hashPassword(crypto.randomBytes(18).toString("hex")); // conta sem acesso: só para aparecer nas listas
  const studentRows = keep(
    "users",
    await db
      .insert(users)
      .values(students.map((n, i) => ({ name: n, email: `${slug(n)}.aluna@exemplo.pt`, passwordHash: pw, role: "student" as const, createdAt: ago(150 - i * 12) })))
      .returning()
  );
  const [c1, c2] = courseRows;
  const enr: (typeof enrollments.$inferInsert)[] = [];
  const prog: (typeof lessonProgress.$inferInsert)[] = [];
  for (const [i, s] of studentRows.entries()) {
    const mine = i % 3 === 0 ? [c1, c2] : i % 3 === 1 ? [c1] : [c2];
    for (const c of mine) {
      const since = int(10, 140);
      enr.push({ userId: s.id, courseId: c.id, createdAt: ago(since) });
      const ls = lessonIdsByCourse.get(c.id)!;
      const done = Math.floor(ls.length * pick([0, 0.2, 0.4, 0.6, 0.8, 1, 1]));
      ls.slice(0, done).forEach((lessonId, k) => prog.push({ userId: s.id, lessonId, completedAt: ago(Math.max(0, since - (k + 1) * int(1, 6))) }));
    }
  }
  await db.insert(enrollments).values(enr);
  if (prog.length) await db.insert(lessonProgress).values(prog);

  /* ---- marketing ---- */
  console.log("A criar conteúdos de marketing...");
  const post = (title: string, network: string, format: string, status: "idea" | "production" | "review" | "approved" | "published", day: number, h = 10, copy?: string, hashtags?: string) => ({
    title,
    network,
    format,
    status,
    publishAt: at(day, h),
    copy: copy ?? null,
    hashtags: hashtags ?? null,
  });
  keep(
    "posts",
    await db
      .insert(posts)
      .values([
        post("Antes/depois: rebranding Estúdio Meridional", "Instagram", "Carrossel", "published", -24, 10, "O poder de um sistema visual coerente — veja a transformação completa.", "#branding #identidadevisual #designer"),
        post("3 erros que barateiam o seu portfólio", "Blog", "Artigo", "published", -19, 9),
        post("Reels: o meu processo de moodboard em 40s", "Instagram", "Reels", "published", -15, 19, "Do caos ao conceito em 40 segundos.", "#processocriativo #moodboard"),
        post("Newsletter O Dossiê #24 — preço sem medo", "Email", "Newsletter", "published", -12, 8),
        post("Case: identidade para a Padaria Aurora", "LinkedIn", "Post estático", "published", -9, 9),
        post("Stories: um dia de mentoria", "Instagram", "Stories", "published", -6, 15),
        post("Newsletter O Dossiê #25 — a proposta perfeita", "Email", "Newsletter", "published", -5, 8),
        post("Reels: tipografia que mudou tudo", "Instagram", "Reels", "published", -2, 19),
        post("Carrossel: anatomia de uma proposta premium", "Instagram", "Carrossel", "approved", 1, 10, "Slide a slide: como apresento um orçamento de 5 dígitos."),
        post("Tutorial: paleta 60/30/10 em 2 minutos", "TikTok", "Vídeo", "approved", 2, 18),
        post("Post LinkedIn: porque recuso clientes baratos", "LinkedIn", "Post estático", "review", 3, 9),
        post("Stories: bastidores da gravação do curso", "Instagram", "Stories", "production", 3, 15),
        post("Vídeo: análise de 3 portfólios de alunas", "YouTube", "Vídeo", "production", 5, 17),
        post("Newsletter O Dossiê #26 — clientes ideais", "Email", "Newsletter", "review", 6, 8),
        post("Carrossel: 5 sinais de que está a cobrar pouco", "Instagram", "Carrossel", "production", 7, 10),
        post("Anúncio: Workshop Marca Premium (novembro)", "Facebook", "Post estático", "approved", 8, 10),
        post("Reels: review de logótipos de seguidoras", "Instagram", "Reels", "idea", 10, 19),
        post("Artigo SEO: quanto cobrar por um logótipo", "Blog", "Artigo", "idea", 12, 9),
        post("Live: perguntas sobre mentoria", "Instagram", "Vídeo", "idea", 14, 21),
        post("Carrossel: o meu stack de ferramentas", "Instagram", "Carrossel", "idea", 17, 10),
        post("Post LinkedIn: aprendizagens de 10 anos de estúdio", "LinkedIn", "Post estático", "idea", 20, 9),
      ])
      .returning({ id: posts.id })
  );

  /* ---- link na bio: links e estatísticas ---- */
  const haveLinks = await db.select().from(bioLinks);
  const extraLinks = [
    { title: "Curso Branding Estratégico", subtitle: "Do briefing ao manual de marca", url: `/cursos`, image: "/img/curso-marca.jpg" },
    { title: "Newsletter O Dossiê", subtitle: "Uma carta por semana sobre marca e preço", url: "/#newsletter" },
  ].filter((l) => !haveLinks.some((h) => h.title === l.title));
  if (extraLinks.length) {
    const maxOrder = Math.max(0, ...haveLinks.map((l) => l.order));
    keep("bioLinks", await db.insert(bioLinks).values(extraLinks.map((l, i) => ({ ...l, order: maxOrder + i + 1 }))).returning());
  }
  const links = await db.select().from(bioLinks).where(eq(bioLinks.active, true));
  const targets = [...links.map((l) => `l${l.id}`), "agendar", "whatsapp", "agendar", ...courseRows.slice(0, 2).map((c) => `c${c.id}`)];
  const refs = ["instagram.com", "instagram.com", "instagram.com", "linkedin.com", "tiktok.com", null];
  const be: (typeof bioEvents.$inferInsert)[] = [];
  for (let d = 59; d >= 0; d--) {
    const views = int(8, 30) + Math.floor((60 - d) / 6);
    for (let v = 0; v < views; v++) {
      const t = ago(d, int(8, 23));
      if (t > new Date()) continue;
      be.push({ kind: "view", referrer: pick(refs), createdAt: t });
      if (rnd() < 0.42) be.push({ kind: "click", target: pick(targets), referrer: pick(refs), createdAt: new Date(t.getTime() + int(3, 60) * 1000) });
    }
  }
  for (let i = 0; i < be.length; i += 500) keep("bioEvents", await db.insert(bioEvents).values(be.slice(i, i + 500)).returning({ id: bioEvents.id }));

  await db.insert(settings).values({ key: KEY, value: JSON.stringify({ ids, files, at: new Date().toISOString() } satisfies Stored) });

  console.log("");
  console.log("✓ Dados de demonstração criados:");
  console.log(`  ${contactRows.length} contactos, ${dealDefs.length} negócios, ${pay.length} pagamentos, ${exp.length} despesas`);
  console.log(`  ${ids.appointments.length} marcações, ${ids.agendaEvents.length} eventos, ${wa.length} mensagens de WhatsApp`);
  console.log(`  ${courseRows.length} cursos com ${files.length} materiais em PDF, ${studentRows.length} alunas, ${prog.length} aulas concluídas`);
  console.log(`  ${ids.posts.length} conteúdos de marketing, ${be.length} visitas/cliques na bio`);
  console.log("\nPara remover tudo: npm run db:demo -- --remover");
}

const run = process.argv.includes("--remover") ? remove : create;
run()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });

