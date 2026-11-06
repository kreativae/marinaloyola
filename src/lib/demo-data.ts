import { and, asc, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  agendaEvents,
  appointments,
  contacts,
  contactTags,
  deals,
  eventTypes,
  expenses,
  forms,
  formSubmissions,
  interactions,
  noteContacts,
  noteFolders,
  notes,
  payments,
  pipelineStages,
  posts,
  settings,
  tags,
  whatsappMessages,
} from "@/db/schema";
import { readRaw } from "@/lib/settings";

/**
 * Dados de demonstração. Os ids criados ficam guardados em settings: a remoção apaga só esses
 * registos. Emails em .invalid e números 900… não pertencem a ninguém, por isso nunca chega nada
 * a uma pessoa real. Nada aqui dispara emails, WhatsApp ou avisos à equipa.
 */

const KEY = "demo_data";

type Manifest = {
  createdAt: string;
  contacts: number[];
  notes: number[];
  folders: number[];
  events: number[];
  expenses: number[];
  posts: number[];
  tags: number[];
  stages: number[];
  counts: { label: string; count: number }[];
};

export type DemoStatus = Pick<Manifest, "createdAt" | "counts"> | null;

async function readManifest(): Promise<Manifest | null> {
  const raw = (await readRaw([KEY]))[KEY];
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    return m?.createdAt ? (m as Manifest) : null;
  } catch {
    return null;
  }
}

export async function demoStatus(): Promise<DemoStatus> {
  const m = await readManifest();
  return m && { createdAt: m.createdAt, counts: m.counts };
}

const DAY = 86_400_000;
/** Dia relativo a hoje (negativo = passado), à hora indicada. */
const at = (days: number, hour = 10, minute = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const PT = { country: "PT", timezone: "Europe/Lisbon" };
const BR = { country: "BR", timezone: "America/Sao_Paulo" };

const PEOPLE = [
  { name: "Ana Ribeiro", city: "Lisboa", ...PT, status: "client", source: "site", tags: ["Mentoria"], days: -150 },
  { name: "Beatriz Campos", city: "Porto", ...PT, status: "client", source: "referral", tags: ["Mentoria"], days: -120 },
  { name: "Carla Mendonça", city: "São Paulo", ...BR, status: "client", source: "hotmart", tags: ["Workshop"], days: -100 },
  { name: "Daniela Fonseca", city: "Coimbra", ...PT, status: "negotiating", source: "whatsapp", tags: ["Lead quente"], days: -40 },
  { name: "Eduarda Nogueira", city: "Curitiba", ...BR, status: "negotiating", source: "social", tags: ["Lead quente"], days: -32 },
  { name: "Filipa Teixeira", city: "Braga", ...PT, status: "qualified", source: "site", tags: ["Mentoria"], days: -25 },
  { name: "Gabriela Prado", city: "Belo Horizonte", ...BR, status: "qualified", source: "whatsapp", tags: ["Workshop"], days: -18 },
  { name: "Helena Vasconcelos", city: "Faro", ...PT, status: "lead", source: "site", tags: [], days: -9 },
  { name: "Inês Sampaio", city: "Setúbal", ...PT, status: "lead", source: "social", tags: [], days: -6 },
  { name: "Juliana Barreto", city: "Recife", ...BR, status: "lead", source: "whatsapp", tags: [], days: -3 },
  { name: "Karina Duarte", city: "Aveiro", ...PT, status: "inactive", source: "manual", tags: [], days: -170 },
  { name: "Laura Magalhães", city: "Rio de Janeiro", ...BR, status: "lost", source: "referral", tags: [], days: -80 },
] as const;

const slug = (name: string) =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, ".");
const phoneOf = (i: number, country: string) =>
  country === "BR" ? `+551190000${String(i + 1).padStart(4, "0")}` : `+35190000${String(i + 1).padStart(4, "0")}`;

const CHATS: { who: number; days: number; lines: [("in" | "out"), string][] }[] = [
  {
    who: 3,
    days: -2,
    lines: [
      ["in", "Olá! Vi o vosso programa de mentoria e gostava de saber mais."],
      ["out", "Olá, Daniela! Claro. Em que fase está o seu negócio neste momento?"],
      ["in", "Comecei há um ano e sinto que preciso de mais estrutura."],
      ["out", "Faz todo o sentido. Posso enviar-lhe a proposta e marcamos uma conversa?"],
      ["in", "Sim, por favor. Pode ser esta semana?"],
    ],
  },
  {
    who: 4,
    days: -1,
    lines: [
      ["in", "Oi! Qual é o valor da mentoria individual?"],
      ["out", "Oi, Eduarda! Enviei a proposta para o seu email, com as opções de parcelamento."],
      ["in", "Recebi, obrigada. Vou ver com calma e respondo até sexta."],
    ],
  },
  {
    who: 9,
    days: 0,
    lines: [
      ["in", "Bom dia! O próximo workshop ainda tem vagas?"],
      ["in", "Queria inscrever-me com uma amiga."],
    ],
  },
  {
    who: 0,
    days: -5,
    lines: [
      ["out", "Olá, Ana! Tudo pronto para a sessão de quinta?"],
      ["in", "Tudo! Já preparei os pontos que combinámos."],
      ["out", "Perfeito, até quinta."],
    ],
  },
];

export async function createDemoData(authorId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    // A linha em settings impede dois carregamentos ao mesmo tempo
    const [claimed] = await tx.insert(settings).values({ key: KEY, value: "{}" }).onConflictDoNothing().returning();
    if (!claimed) return false;

    const m: Manifest = {
      createdAt: new Date().toISOString(),
      contacts: [], notes: [], folders: [], events: [], expenses: [], posts: [], tags: [], stages: [], counts: [],
    };

    /* Etiquetas: as que já existem ficam; só as novas são apagadas na remoção */
    const tagId = new Map<string, number>();
    for (const [name, color] of [["Demonstração", "#f59e0b"], ["Mentoria", "#800080"], ["Workshop", "#0ea5e9"], ["Lead quente", "#ef4444"]]) {
      const [found] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).limit(1);
      if (found) {
        tagId.set(name, found.id);
        continue;
      }
      const [row] = await tx.insert(tags).values({ name, color }).returning({ id: tags.id });
      tagId.set(name, row.id);
      m.tags.push(row.id);
    }

    /* Contactos */
    const people = await tx
      .insert(contacts)
      .values(
        PEOPLE.map((p, i) => ({
          name: p.name,
          email: `${slug(p.name)}@demo.invalid`,
          phone: phoneOf(i, p.country),
          location: p.city,
          country: p.country,
          timezone: p.timezone,
          status: p.status,
          source: p.source,
          notes: "Contacto de demonstração.",
          createdAt: at(p.days),
        }))
      )
      .returning({ id: contacts.id, name: contacts.name, email: contacts.email, phone: contacts.phone });
    m.contacts = people.map((c) => c.id);
    await tx.insert(contactTags).values(
      PEOPLE.flatMap((p, i) =>
        ["Demonstração", ...p.tags].map((t) => ({ contactId: people[i].id, tagId: tagId.get(t)! }))
      )
    );

    /* Histórico */
    const history = await tx
      .insert(interactions)
      .values(
        PEOPLE.flatMap((p, i) => [
          { contactId: people[i].id, type: "system", content: "Contacto de demonstração criado.", createdAt: at(p.days) },
          { contactId: people[i].id, type: "note", content: "Primeira conversa: quer organizar melhor o negócio e ganhar clientes novos.", createdAt: at(p.days + 1, 15) },
        ])
      )
      .returning({ id: interactions.id });

    /* WhatsApp */
    const messages = CHATS.flatMap((chat) =>
      chat.lines.map(([direction, body], i) => ({
        contactId: people[chat.who].id,
        direction,
        body,
        // A última mensagem recebida fica por ler, para mostrar o contador
        readAt: direction === "in" && i === chat.lines.length - 1 ? null : at(chat.days, 9, i * 6 + 2),
        createdAt: at(chat.days, 9, i * 6),
      }))
    );
    await tx.insert(whatsappMessages).values(messages);

    /* Pipeline */
    let stages = await tx.select().from(pipelineStages).orderBy(asc(pipelineStages.order), asc(pipelineStages.id));
    if (!stages.length) {
      stages = await tx
        .insert(pipelineStages)
        .values(["Novo lead", "Qualificado", "Proposta", "Negociação"].map((name, order) => ({ name, order })))
        .returning();
      m.stages = stages.map((s) => s.id);
    }
    const stage = (i: number) => stages[Math.min(i, stages.length - 1)].id;
    const dealRows = await tx
      .insert(deals)
      .values([
        { contactId: people[7].id, stageId: stage(0), title: "Helena · Mentoria individual", value: "1200", expectedClose: at(30) },
        { contactId: people[8].id, stageId: stage(0), title: "Inês · Workshop", product: "Workshop", value: "180", expectedClose: at(21) },
        { contactId: people[5].id, stageId: stage(1), title: "Filipa · Mentoria em grupo", value: "690", expectedClose: at(18) },
        { contactId: people[6].id, stageId: stage(1), title: "Gabriela · Workshop", product: "Workshop", value: "180", expectedClose: at(14) },
        { contactId: people[3].id, stageId: stage(2), title: "Daniela · Mentoria individual", value: "1500", expectedClose: at(7) },
        { contactId: people[4].id, stageId: stage(3), title: "Eduarda · Mentoria individual", value: "1500", expectedClose: at(4) },
        { contactId: people[0].id, stageId: stage(3), title: "Ana · Mentoria individual", value: "1500", outcome: "won", closedAt: at(-140) },
        { contactId: people[11].id, stageId: stage(2), title: "Laura · Mentoria em grupo", value: "690", outcome: "lost", closedAt: at(-60), lostReason: "Sem orçamento neste momento" },
      ])
      .returning({ id: deals.id });

    /* Financeiro */
    const paid = (i: number, product: string, amount: string, method: "hotmart" | "mbway" | "transfer", days: number) => ({
      contactId: people[i].id, product, amount, method, status: "confirmed" as const,
      reference: `DEMO-${String(Math.abs(days)).padStart(3, "0")}`, paidAt: at(days), createdAt: at(days),
    });
    const paymentRows = await tx
      .insert(payments)
      .values([
        ...[1, 2, 3].map((n) => ({
          ...paid(0, "Mentoria individual", "500", "transfer", -140 + (n - 1) * 30),
          installment: n, installments: 3, planRef: "demo-plano-ana",
        })),
        paid(1, "Mentoria em grupo", "690", "mbway", -110),
        paid(2, "Workshop", "180", "hotmart", -95),
        paid(2, "Workshop avançado", "240", "hotmart", -45),
        paid(1, "Sessão avulso", "120", "mbway", -20),
        paid(0, "Sessão avulso", "120", "transfer", -8),
        { contactId: people[3].id, product: "Mentoria individual", amount: "500", method: "transfer" as const, status: "pending" as const, dueDate: at(5), installment: 1, installments: 3, planRef: "demo-plano-daniela" },
        { contactId: people[5].id, product: "Mentoria em grupo", amount: "690", method: "mbway" as const, status: "pending" as const, dueDate: at(-3) },
        { contactId: people[11].id, product: "Workshop", amount: "180", method: "hotmart" as const, status: "refunded" as const, reference: "DEMO-REEMB", paidAt: null, createdAt: at(-70) },
      ])
      .returning({ id: payments.id });
    const expenseRows = await tx
      .insert(expenses)
      .values([
        { description: "Ferramentas de design", category: "Software", amount: "29", date: at(-15), supplier: "Fornecedor Demo", recurring: true },
        { description: "Alojamento do site", category: "Software", amount: "18", date: at(-12), supplier: "Fornecedor Demo", recurring: true },
        { description: "Anúncios de redes sociais", category: "Marketing", amount: "150", date: at(-28), supplier: "Fornecedor Demo" },
        { description: "Contabilidade", category: "Serviços", amount: "90", date: at(-35), supplier: "Fornecedor Demo", recurring: true },
        { description: "Sala para workshop", category: "Eventos", amount: "220", date: at(-50), supplier: "Fornecedor Demo" },
      ])
      .returning({ id: expenses.id });
    m.expenses = expenseRows.map((e) => e.id);

    /* Agenda: nada aqui tira horários à página pública de marcações */
    const eventRows = await tx
      .insert(agendaEvents)
      .values([
        { title: "Preparar workshop", startAt: at(2, 10), endAt: at(2, 11, 30), blocksBooking: false, color: "#0ea5e9" },
        { title: "Reunião de equipa", startAt: at(4, 14), endAt: at(4, 15), blocksBooking: false, color: "#10b981" },
        { title: "Sessão com Ana Ribeiro", startAt: at(6, 16), endAt: at(6, 17), blocksBooking: false, color: "#800080", contactId: people[0].id },
        { title: "Gravar conteúdos", startAt: at(9, 9), endAt: at(9, 12), blocksBooking: false, color: "#f59e0b" },
      ])
      .returning({ id: agendaEvents.id });
    m.events = eventRows.map((e) => e.id);

    let appts = 0;
    const [type] = await tx.select().from(eventTypes).orderBy(asc(eventTypes.id)).limit(1);
    if (type) {
      const min = type.durationMin * 60_000;
      const slot = (i: number, start: Date, status: "completed" | "confirmed") => ({
        eventTypeId: type.id, contactId: people[i].id, name: people[i].name, email: people[i].email!, phone: people[i].phone,
        startAt: start, endAt: new Date(start.getTime() + min), status, timezone: PEOPLE[i].timezone,
      });
      // Marcações futuras às 21h, depois do horário de trabalho, para não ocuparem horas livres
      const rows = await tx
        .insert(appointments)
        .values([
          slot(0, at(-14, 11), "completed"),
          slot(1, at(-7, 15), "completed"),
          slot(3, at(3, 21), "confirmed"),
          slot(6, at(8, 21), "confirmed"),
        ])
        .returning({ id: appointments.id });
      appts = rows.length;
    }

    /* Notas */
    const [folder] = await tx.insert(noteFolders).values({ name: "Demonstração" }).returning({ id: noteFolders.id });
    m.folders = [folder.id];
    const noteRows = await tx
      .insert(notes)
      .values(
        [
          ["# Ideias para o próximo workshop\n- Rever exercícios práticos\n- Convidar uma aluna antiga\n#workshop", true],
          ["# Tarefas da semana\n- [x] Enviar propostas\n- [ ] Confirmar sala\n- [ ] Publicar calendário", false],
          ["# Conversa com a Daniela\nQuer começar no próximo mês. Enviar proposta com três parcelas.", false],
          ["# Temas para conteúdos\n- Bastidores da mentoria\n- Erros comuns de quem começa\n#marketing", false],
        ].map(([body, pinned]) => ({
          title: String(body).split("\n")[0].replace(/^#\s*/, ""),
          body: String(body),
          pinned: Boolean(pinned),
          folderId: folder.id,
          authorId,
        }))
      )
      .returning({ id: notes.id });
    m.notes = noteRows.map((n) => n.id);
    await tx.insert(noteContacts).values({ noteId: noteRows[2].id, contactId: people[3].id });

    /* Marketing */
    const postRows = await tx
      .insert(posts)
      .values([
        { title: "Três erros de quem começa", publishAt: at(3, 12), status: "production", copy: "Texto de demonstração." },
        { title: "Bastidores da mentoria", publishAt: at(6, 18), format: "Reels", status: "review", copy: "Texto de demonstração." },
        { title: "Testemunho de aluna", publishAt: at(10, 12), status: "approved", copy: "Texto de demonstração." },
        { title: "Como organizar a semana", status: "idea" },
      ])
      .returning({ id: posts.id });
    m.posts = postRows.map((p) => p.id);

    /* Respostas a formulários, se já houver algum */
    let answers = 0;
    const [form] = await tx.select({ id: forms.id }).from(forms).orderBy(asc(forms.id)).limit(1);
    if (form) {
      const rows = await tx
        .insert(formSubmissions)
        .values(
          [7, 8, 9].map((i) => ({
            formId: form.id,
            contactId: people[i].id,
            name: people[i].name,
            email: people[i].email!,
            phone: people[i].phone,
            answers: [
              { id: "name", label: "Nome", value: people[i].name },
              { id: "email", label: "Email", value: people[i].email! },
              { id: "message", label: "Mensagem", value: "Gostava de saber mais sobre a mentoria." },
            ],
            createdAt: at(PEOPLE[i].days, 11),
          }))
        )
        .returning({ id: formSubmissions.id });
      answers = rows.length;
    }

    m.counts = [
      { label: "Contactos", count: people.length },
      { label: "Registos do histórico", count: history.length },
      { label: "Mensagens de WhatsApp", count: messages.length },
      { label: "Negócios no Pipeline", count: dealRows.length },
      { label: "Pagamentos", count: paymentRows.length },
      { label: "Despesas", count: expenseRows.length },
      { label: "Eventos da agenda", count: eventRows.length },
      { label: "Agendamentos", count: appts },
      { label: "Notas", count: noteRows.length },
      { label: "Publicações de Marketing", count: postRows.length },
      { label: "Respostas a formulários", count: answers },
    ].filter((c) => c.count > 0);

    await tx.update(settings).set({ value: JSON.stringify(m) }).where(eq(settings.key, KEY));
    return true;
  });
}

/** Apaga só o que foi criado. Um contacto mesclado pode ter dados reais, por isso fica. */
export async function removeDemoData(): Promise<{ kept: number } | null> {
  const m = await readManifest();
  if (!m) return null;
  return db.transaction(async (tx) => {
    const merged = m.contacts.length
      ? await tx
          .selectDistinct({ id: interactions.contactId })
          .from(interactions)
          .where(and(inArray(interactions.contactId, m.contacts), like(interactions.content, "Contacto “%mesclado%")))
      : [];
    const keep = new Set(merged.map((r) => r.id));
    const ids = m.contacts.filter((id) => !keep.has(id));
    if (ids.length) {
      await tx.delete(appointments).where(inArray(appointments.contactId, ids));
      await tx.delete(formSubmissions).where(inArray(formSubmissions.contactId, ids));
      await tx.delete(contacts).where(inArray(contacts.id, ids));
    }
    if (m.notes.length) await tx.delete(notes).where(inArray(notes.id, m.notes));
    if (m.folders.length) await tx.delete(noteFolders).where(inArray(noteFolders.id, m.folders));
    if (m.events.length) await tx.delete(agendaEvents).where(inArray(agendaEvents.id, m.events));
    if (m.expenses.length) await tx.delete(expenses).where(inArray(expenses.id, m.expenses));
    if (m.posts.length) await tx.delete(posts).where(inArray(posts.id, m.posts));
    if (m.tags.length) await tx.delete(tags).where(inArray(tags.id, m.tags));
    if (m.stages.length) await tx.delete(pipelineStages).where(inArray(pipelineStages.id, m.stages));
    await tx.delete(settings).where(eq(settings.key, KEY));
    return { kept: keep.size };
  });
}
