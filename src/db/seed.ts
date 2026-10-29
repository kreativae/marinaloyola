import "dotenv/config";
import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { inferFromPhone } from "../lib/timezones";
import { db, pool } from "./index";
import {
  appointments,
  availability,
  bioLinks,
  channels,
  contacts,
  contactTags,
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
} from "./schema";

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const daysFromNow = (n: number, h = 10, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, min, 0, 0);
  return d;
};
const daysAgo = (n: number, h = 12) => daysFromNow(-n, h);
const monthsAgo = (m: number, day = 15) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - m, day, 12, 0);
};

const V1 = "https://videos.pexels.com/video-files/4347781/4347781-hd_1920_1080_25fps.mp4";
const V2 = "https://videos.pexels.com/video-files/4347863/4347863-hd_1920_1080_25fps.mp4";
const V3 = "https://videos.pexels.com/video-files/36518090/15484750_3840_2160_30fps.mp4";

async function main() {
  console.log("A limpar dados antigos...");
  await db.delete(lessonProgress);
  await db.delete(enrollments);
  await db.delete(lessons);
  await db.delete(modules);
  await db.delete(courses);
  await db.delete(appointments);
  await db.delete(eventTypes);
  await db.delete(availability);
  await db.delete(payments);
  await db.delete(expenses);
  await db.delete(bioLinks);
  await db.delete(deals);
  await db.delete(pipelineStages);
  await db.delete(interactions);
  await db.delete(contactTags);
  await db.delete(tags);
  await db.delete(contacts);
  await db.delete(channels);
  await db.delete(posts);
  await db.delete(users);
  await db.delete(settings);

  console.log("A criar utilizadores...");
  const [marina, sofia, ines] = await db
    .insert(users)
    .values([
      {
        name: "Marina Loyola",
        email: "marina@marinaloyola.com",
        passwordHash: hashPassword("marina123"),
        role: "admin" as const,
      },
      {
        name: "Sofia Andrade",
        email: "sofia@email.com",
        passwordHash: hashPassword("aluno123"),
        role: "student" as const,
      },
      {
        name: "Inês Marques",
        email: "ines@email.com",
        passwordHash: hashPassword("aluno123"),
        role: "student" as const,
      },
    ])
    .returning();

  console.log("A criar tags...");
  const tagDefs = [
    ["WhatsApp", "#25d366"],
    ["Lead Hotmart", "#f97316"],
    ["Cliente Hotmart", "#f97316"],
    ["Comprador Workshop — Marca Premium", "#a855f7"],
    ["Comprador Curso Identidade com Assinatura", "#a855f7"],
    ["Cliente Mentoria", "#800080"],
    ["Newsletter — O Dossiê", "#0ea5e9"],
    ["Agendamento", "#a855f7"],
    ["VIP", "#eab308"],
    ["Contacto Site", "#71717a"],
  ] as const;
  const tagRows = await db
    .insert(tags)
    .values(tagDefs.map(([name, color]) => ({ name, color })))
    .returning();
  const tagId = (name: string) => tagRows.find((t) => t.name === name)!.id;

  console.log("A criar contactos...");
  const contactDefs = [
    { name: "Sofia Andrade", email: "sofia@email.com", phone: "+351 912 440 771", location: "Lisboa", source: "whatsapp" as const, status: "client" as const, created: daysAgo(170), tg: ["WhatsApp", "Cliente Mentoria", "VIP"] },
    { name: "Inês Marques", email: "ines@email.com", phone: "+351 965 220 318", location: "Porto", source: "hotmart" as const, status: "client" as const, created: daysAgo(140), tg: ["Cliente Hotmart", "Comprador Workshop — Marca Premium"] },
    { name: "Beatriz Lemos", email: "beatriz.lemos@email.com", phone: "+55 81 99455-7090", location: "Recife", source: "site" as const, status: "qualified" as const, created: daysAgo(36), tg: ["Contacto Site"] },
    { name: "Carolina Peixoto", email: "carolina.peixoto@email.com", phone: null, location: "Braga", source: "hotmart" as const, status: "client" as const, created: daysAgo(96), tg: ["Cliente Hotmart", "Comprador Curso Identidade com Assinatura"] },
    { name: "Marta Saldanha", email: "marta.saldanha@email.com", phone: "+351 918 663 402", location: "Coimbra", source: "whatsapp" as const, status: "negotiating" as const, created: daysAgo(21), tg: ["WhatsApp", "Agendamento"] },
    { name: "Joana Cerejo", email: "joana.cerejo@email.com", phone: null, location: "Faro", source: "site" as const, status: "lead" as const, created: daysAgo(4), tg: ["Newsletter — O Dossiê"] },
    { name: "Rita Batalha", email: "rita.batalha@email.com", phone: "+55 21 99188-4233", location: "Rio de Janeiro", source: "referral" as const, status: "client" as const, created: daysAgo(66), tg: ["Cliente Mentoria"] },
    { name: "Teresa Valente", email: "teresa.valente@email.com", phone: "+44 7700 900123", location: "Londres", source: "social" as const, status: "lead" as const, created: daysAgo(9), tg: ["Newsletter — O Dossiê"] },
    { name: "Ana Costa Pinto", email: "ana.costapinto@email.com", phone: null, location: "Cascais", source: "hotmart" as const, status: "lost" as const, created: daysAgo(150), tg: ["Lead Hotmart"] },
    { name: "Luísa Figueiredo", email: "luisa.figueiredo@email.com", phone: "+351 935 112 764", location: "Évora", source: "manual" as const, status: "inactive" as const, created: daysAgo(120), tg: [] },
    { name: "Mariana Coutinho", email: "mariana.coutinho@email.com", phone: "+55 11 98744-8209", location: "São Paulo", source: "whatsapp" as const, status: "qualified" as const, created: daysAgo(13), tg: ["WhatsApp", "Agendamento"] },
    { name: "Diana Resende", email: "diana.resende@email.com", phone: null, location: "Viseu", source: "site" as const, status: "lead" as const, created: daysAgo(2), tg: ["Contacto Site"] },
  ];
  const contactRows = await db
    .insert(contacts)
    .values(contactDefs.map(({ tg, created, ...c }) => ({ ...c, createdAt: created })))
    .returning();
  const byEmail = new Map(contactRows.map((c) => [c.email, c]));

  // País e fuso: pelo indicativo do telefone; sem telefone, as cidades portuguesas ficam em Lisboa
  for (const c of contactRows) {
    const locale = inferFromPhone(c.phone) ?? { country: "PT", timezone: "Europe/Lisbon" };
    await db.update(contacts).set(locale).where(eq(contacts.id, c.id));
    Object.assign(c, locale);
  }

  // Canais de origem (networking) e quem indicou
  const channelRows = await db
    .insert(channels)
    .values([
      { name: "BNI", color: "#c8102e" },
      { name: "CNN", color: "#1d4ed8" },
      { name: "BNEX", color: "#0f766e" },
      { name: "Eventos & palestras", color: "#b45309" },
    ])
    .returning();
  const channelId = (name: string) => channelRows.find((c) => c.name === name)!.id;
  const channelOf: [string, string, string | null][] = [
    ["sofia@email.com", "BNI", "Paula Reis (BNI Lisboa Centro)"],
    ["rita.batalha@email.com", "BNI", "Sofia Andrade"],
    ["marta.saldanha@email.com", "BNI", "Paula Reis (BNI Lisboa Centro)"],
    ["beatriz.lemos@email.com", "CNN", null],
    ["mariana.coutinho@email.com", "CNN", "Helena Gomes"],
    ["luisa.figueiredo@email.com", "BNEX", "Rui Tavares"],
    ["teresa.valente@email.com", "Eventos & palestras", null],
  ];
  for (const [email, ch, ref] of channelOf) {
    await db
      .update(contacts)
      .set({ channelId: channelId(ch), referredBy: ref })
      .where(eq(contacts.id, byEmail.get(email)!.id));
  }

  console.log("A ligar tags...");
  await db.insert(contactTags).values(
    contactDefs.flatMap((d) =>
      d.tg.map((t) => ({ contactId: byEmail.get(d.email)!.id, tagId: tagId(t) }))
    )
  );

  console.log("A criar interações...");
  const interDefs: Array<[string, string, string, Date]> = [
    ["sofia@email.com", "whatsapp", "Primeiro contacto via WhatsApp: queria perceber se a mentoria servia para o seu estúdio.", daysAgo(170, 11)],
    ["sofia@email.com", "purchase", "Pagamento registado: Mentoria Design Business — €1.800,00 via transfer (completed).", daysAgo(168)],
    ["sofia@email.com", "booking", "Agendou “Sessão de Mentoria” — sessão 12 concluída. Plano de 90 dias entregue.", daysAgo(6)],
    ["ines@email.com", "purchase", "Hotmart [purchase_approved]: Workshop — Marca Premium em 3 Dias — €89,00 → confirmed.", daysAgo(140)],
    ["ines@email.com", "note", "Pediu certificado do workshop. Emitido com sucesso.", daysAgo(128)],
    ["marta.saldanha@email.com", "whatsapp", "Muito interessada na mentoria. Enviada proposta de valor por PDF.", daysAgo(8)],
    ["marta.saldanha@email.com", "booking", "Agendou “Sessão Exploratória” para breve.", daysAgo(2)],
    ["beatriz.lemos@email.com", "note", "Formulário do site: quer rebranding do estúdio antes de subir preços.", daysAgo(36)],
    ["beatriz.lemos@email.com", "email", "Enviada proposta de mentoria faseada (3 × 620€).", daysAgo(12)],
    ["joana.cerejo@email.com", "note", "Subscreveu a newsletter O Dossiê a partir do guia gratuito.", daysAgo(4)],
    ["rita.batalha@email.com", "purchase", "Pagamento registado: Mentoria Design Business — €1.800,00 via mbway (completed).", daysAgo(60)],
    ["ana.costapinto@email.com", "purchase", "Hotmart [purchase_refunded]: Curso Identidade com Assinatura — reembolso processado.", daysAgo(145)],
    ["mariana.coutinho@email.com", "booking", "Agendou “Sessão Exploratória”. Preparar análise do portfólio.", daysAgo(5)],
    ["diana.resende@email.com", "note", "Novo lead do site — pediu informações sobre workshops.", daysAgo(2)],
  ];
  await db.insert(interactions).values(
    interDefs.map(([email, type, content, createdAt]) => ({
      contactId: byEmail.get(email)!.id,
      type,
      content,
      createdAt,
    }))
  );

  console.log("A criar pipelines...");
  const mentoriaStages = await db
    .insert(pipelineStages)
    .values([
      { pipeline: "mentoria", name: "Novo Lead", order: 1, color: "#71717a" },
      { pipeline: "mentoria", name: "Contactado", order: 2, color: "#0ea5e9" },
      { pipeline: "mentoria", name: "Qualificado", order: 3, color: "#a855f7" },
      { pipeline: "mentoria", name: "Proposta Enviada", order: 4, color: "#f59e0b" },
      { pipeline: "mentoria", name: "Pagamento Confirmado", order: 5, color: "#10b981" },
      { pipeline: "mentoria", name: "Cliente Ativo", order: 6, color: "#800080" },
    ])
    .returning();
  const workshopStages = await db
    .insert(pipelineStages)
    .values([
      { pipeline: "workshops", name: "Novo Lead", order: 1, color: "#71717a" },
      { pipeline: "workshops", name: "Inscrito", order: 2, color: "#0ea5e9" },
      { pipeline: "workshops", name: "Pagamento Pendente", order: 3, color: "#f59e0b" },
      { pipeline: "workshops", name: "Confirmado", order: 4, color: "#10b981" },
      { pipeline: "workshops", name: "Concluído", order: 5, color: "#800080" },
    ])
    .returning();
  const ms = (n: number) => mentoriaStages.find((s) => s.order === n)!.id;
  const ws = (n: number) => workshopStages.find((s) => s.order === n)!.id;

  console.log("A criar negócios...");
  await db.insert(deals).values([
    { contactId: byEmail.get("diana.resende@email.com")!.id, stageId: ms(1), title: "Interesse em mentoria", product: "Mentoria Design Business", value: "1800", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { contactId: byEmail.get("joana.cerejo@email.com")!.id, stageId: ms(1), title: "Lead newsletter → funil", product: "Curso Identidade com Assinatura", value: "197", createdAt: daysAgo(4), updatedAt: daysAgo(4) },
    { contactId: byEmail.get("mariana.coutinho@email.com")!.id, stageId: ms(3), title: "Mentoria Q3 — pós-sessão exploratória", product: "Mentoria Design Business", value: "1800", createdAt: daysAgo(13), updatedAt: daysAgo(5) },
    { contactId: byEmail.get("beatriz.lemos@email.com")!.id, stageId: ms(4), title: "Rebranding + mentoria faseada", product: "Mentoria Design Business", value: "1860", createdAt: daysAgo(20), updatedAt: daysAgo(3) },
    { contactId: byEmail.get("marta.saldanha@email.com")!.id, stageId: ms(4), title: "Proposta PDF enviada", product: "Mentoria Design Business", value: "1800", createdAt: daysAgo(10), updatedAt: daysAgo(1) },
    { contactId: byEmail.get("sofia@email.com")!.id, stageId: ms(6), title: "Mentoria concluída — plano 90 dias", product: "Mentoria Design Business", value: "1800", createdAt: daysAgo(160), updatedAt: daysAgo(6) },
    { contactId: byEmail.get("rita.batalha@email.com")!.id, stageId: ms(6), title: "Mentoria em curso (semana 8)", product: "Mentoria Design Business", value: "1800", createdAt: daysAgo(60), updatedAt: daysAgo(2) },
    { contactId: byEmail.get("ines@email.com")!.id, stageId: ws(5), title: "Workshop Marca Premium #7", product: "Workshop — Marca Premium", value: "89", createdAt: daysAgo(140), updatedAt: daysAgo(126) },
    { contactId: byEmail.get("teresa.valente@email.com")!.id, stageId: ws(2), title: "Inscrição workshop próxima edição", product: "Workshop — Marca Premium", value: "89", createdAt: daysAgo(9), updatedAt: daysAgo(1) },
    { contactId: byEmail.get("carolina.peixoto@email.com")!.id, stageId: ws(4), title: "Curso via Hotmart", product: "Curso Identidade com Assinatura", value: "197", createdAt: daysAgo(96), updatedAt: daysAgo(96) },
    { contactId: byEmail.get("luisa.figueiredo@email.com")!.id, stageId: ws(3), title: "Aguarda pagamento MBWay", product: "Workshop — Marca Premium", value: "89", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
  ]);

  console.log("A criar pagamentos...");
  await db.insert(payments).values([
    { contactId: byEmail.get("ines@email.com")!.id, product: "Workshop — Marca Premium", amount: "89", method: "hotmart", status: "confirmed", createdAt: monthsAgo(5) },
    { contactId: byEmail.get("ana.costapinto@email.com")!.id, product: "Curso Identidade com Assinatura", amount: "197", method: "hotmart", status: "refunded", createdAt: monthsAgo(5, 2) },
    { contactId: byEmail.get("sofia@email.com")!.id, product: "Mentoria Design Business", amount: "620", method: "transfer", status: "completed", reference: "TRF-2026-0142", createdAt: monthsAgo(5, 20) },
    { contactId: byEmail.get("carolina.peixoto@email.com")!.id, product: "Curso Identidade com Assinatura", amount: "197", method: "hotmart", status: "confirmed", createdAt: monthsAgo(4, 8) },
    { contactId: byEmail.get("sofia@email.com")!.id, product: "Mentoria Design Business", amount: "620", method: "transfer", status: "completed", reference: "TRF-2026-0171", createdAt: monthsAgo(4, 19) },
    { contactId: byEmail.get("rita.batalha@email.com")!.id, product: "Mentoria Design Business", amount: "900", method: "mbway", status: "completed", reference: "MBW-88213", createdAt: monthsAgo(3, 4) },
    { contactId: byEmail.get("carolina.peixoto@email.com")!.id, product: "Workshop — Marca Premium", amount: "89", method: "hotmart", status: "confirmed", createdAt: monthsAgo(3, 22) },
    { contactId: byEmail.get("sofia@email.com")!.id, product: "Mentoria Design Business", amount: "560", method: "transfer", status: "completed", reference: "TRF-2026-0203", createdAt: monthsAgo(2, 14) },
    { contactId: byEmail.get("ines@email.com")!.id, product: "Curso Identidade com Assinatura", amount: "197", method: "hotmart", status: "confirmed", createdAt: monthsAgo(2, 3) },
    { contactId: byEmail.get("rita.batalha@email.com")!.id, product: "Mentoria Design Business", amount: "900", method: "mbway", status: "completed", reference: "MBW-90122", createdAt: monthsAgo(1, 6) },
    { contactId: byEmail.get("beatriz.lemos@email.com")!.id, product: "Workshop — Marca Premium", amount: "89", method: "hotmart", status: "confirmed", createdAt: monthsAgo(1, 18) },
    { contactId: byEmail.get("mariana.coutinho@email.com")!.id, product: "Sessão Avulsa", amount: "120", method: "mbway", status: "completed", reference: "MBW-91447", createdAt: daysAgo(12) },
    { contactId: byEmail.get("luisa.figueiredo@email.com")!.id, product: "Workshop — Marca Premium", amount: "89", method: "mbway", status: "pending", dueDate: daysAgo(4), createdAt: daysAgo(6) },
    { contactId: byEmail.get("diana.resende@email.com")!.id, product: "Curso Identidade com Assinatura", amount: "197", method: "hotmart", status: "pending", reference: "HOT-TKN-5521", dueDate: daysFromNow(2, 12, 0), createdAt: daysAgo(1) },
    { contactId: byEmail.get("rita.batalha@email.com")!.id, product: "Mentoria Design Business", amount: "120", method: "mbway", status: "completed", reference: "MBW-93001", createdAt: daysAgo(4) },
  ]);

  // Recebidos contam na data em que entraram
  await db.update(payments).set({ paidAt: sql`${payments.createdAt}` }).where(sql`${payments.status} in ('confirmed','completed')`);

  // Plano em 3 parcelas (mentoria da Marta): 1.ª paga, as outras com vencimento mensal
  const plan = crypto.randomUUID();
  const marta = byEmail.get("marta.saldanha@email.com")!.id;
  await db.insert(payments).values(
    [0, 1, 2].map((i) => {
      const due = new Date(new Date().getFullYear(), new Date().getMonth() + i, 5, 12);
      return {
        contactId: marta,
        product: "Mentoria Design Business",
        amount: "620",
        method: "transfer" as const,
        status: i === 0 ? ("confirmed" as const) : ("pending" as const),
        reference: i === 0 ? "TRF-2026-0288" : null,
        paidAt: i === 0 ? due : null,
        dueDate: i === 0 ? null : due,
        installment: i + 1,
        installments: 3,
        planRef: plan,
        createdAt: daysAgo(24),
      };
    })
  );

  console.log("A criar despesas...");
  const expenseRows: [string, string, string, number, boolean, string | null][] = [
    ["Adobe Creative Cloud", "Software & ferramentas", "59.99", 0, true, "Adobe"],
    ["Figma Professional", "Software & ferramentas", "15", 0, true, "Figma"],
    ["Zoom Pro", "Software & ferramentas", "13.99", 0, true, "Zoom"],
    ["Contabilista certificado", "Contabilidade & serviços", "120", 0, true, "Gabinete Silva & Reis"],
    ["Anúncios Instagram — lançamento workshop", "Marketing & publicidade", "180", 0, false, "Meta"],
    ["Taxas Hotmart", "Taxas (Hotmart, banco)", "42.6", 0, false, "Hotmart"],
  ];
  const expenseValues = [];
  for (let m = 0; m < 6; m++) {
    for (const [description, category, amount, , recurring, supplier] of expenseRows) {
      if (!recurring && m % 2 === 1) continue; // as pontuais só em alguns meses
      expenseValues.push({ description, category, amount, recurring, supplier, date: monthsAgo(m, 3 + (description.length % 20)) });
    }
  }
  expenseValues.push(
    { description: "Segurança Social (trimestral)", category: "Impostos", amount: "345", recurring: false, supplier: null, date: monthsAgo(1, 20) },
    { description: "Monitor calibrado BenQ", category: "Equipamento", amount: "489", recurring: false, supplier: "Worten", date: monthsAgo(3, 11) },
    { description: "Curso de copywriting", category: "Formação", amount: "149", recurring: false, supplier: null, date: monthsAgo(2, 7) }
  );
  await db.insert(expenses).values(expenseValues);

  console.log("A criar links da bio...");
  await db.insert(bioLinks).values([
    { title: "Mentoria Design Business", subtitle: "12 semanas para reposicionar a tua marca — candidaturas abertas", url: "/mentoria", image: "/img/curso-mentoria.jpg", highlight: true, order: 1 },
    { title: "Workshop Marca Premium", subtitle: "3 dias intensivos, ao vivo e com gravações", url: "/cursos", image: "/img/curso-workshop.jpg", order: 2 },
    { title: "Sobre a Marina", subtitle: "A minha história, método e clientes", url: "/sobre", order: 3 },
    { title: "Fala comigo", subtitle: "Dúvidas sobre mentoria, parcerias ou imprensa", url: "/contato", order: 4 },
  ]);

  console.log("A criar agenda...");
  const [et30, et60, et90] = await db
    .insert(eventTypes)
    .values([
      { name: "Sessão Exploratória", description: "30 minutos gratuitos para mapear o seu momento e perceber se a mentoria é o próximo passo certo.", durationMin: 30, color: "#a855f7" },
      { name: "Sessão de Mentoria", description: "Sessão individual do programa de 12 semanas. Traga decisões pendentes e trabalho em curso.", durationMin: 60, color: "#800080" },
      { name: "Workshop / Sessão de Grupo", description: "Sessão intensiva de grupo com trabalho prático e feedback ao vivo.", durationMin: 90, color: "#0ea5e9" },
    ])
    .returning();

  await db.insert(availability).values([
    { dayOfWeek: 0, startTime: "09:00", endTime: "18:00", active: false },
    { dayOfWeek: 1, startTime: "09:30", endTime: "18:00", active: true },
    { dayOfWeek: 2, startTime: "09:30", endTime: "18:00", active: true },
    { dayOfWeek: 3, startTime: "09:30", endTime: "18:00", active: true },
    { dayOfWeek: 4, startTime: "09:30", endTime: "18:00", active: true },
    { dayOfWeek: 5, startTime: "09:30", endTime: "16:00", active: true },
    { dayOfWeek: 6, startTime: "10:00", endTime: "13:00", active: false },
  ]);

  const appt = (
    email: string | null,
    name: string,
    mail: string,
    etId: number,
    start: Date,
    dur: number,
    status: "confirmed" | "cancelled" | "rescheduled" | "completed" = "confirmed",
    created = daysAgo(3)
  ) => ({
    eventTypeId: etId,
    contactId: email ? byEmail.get(email)!.id : null,
    name,
    email: mail,
    phone: email ? byEmail.get(email)!.phone : null,
    timezone: (email && byEmail.get(email)!.timezone) || "Europe/Lisbon",
    startAt: start,
    endAt: new Date(start.getTime() + dur * 60000),
    status,
    meetingUrl: `https://zoom.us/j/${Math.floor(1e9 + Math.random() * 9e9)}`,
    createdAt: created,
  });

  await db.insert(appointments).values([
    appt("marta.saldanha@email.com", "Marta Saldanha", "marta.saldanha@email.com", et30.id, daysFromNow(1, 10, 0), 30),
    appt("mariana.coutinho@email.com", "Mariana Coutinho", "mariana.coutinho@email.com", et60.id, daysFromNow(2, 11, 0), 60),
    appt("rita.batalha@email.com", "Rita Batalha", "rita.batalha@email.com", et60.id, daysFromNow(3, 14, 30), 60),
    appt(null, "Clara Sampaio", "clara.sampaio@email.com", et30.id, daysFromNow(5, 9, 30), 30),
    appt("sofia@email.com", "Sofia Andrade", "sofia@email.com", et60.id, daysAgo(6, 10), 60, "completed"),
    appt("ines@email.com", "Inês Marques", "ines@email.com", et90.id, daysAgo(14, 18), 90, "completed"),
    appt("beatriz.lemos@email.com", "Beatriz Lemos", "beatriz.lemos@email.com", et30.id, daysAgo(20, 15), 30, "completed"),
  ]);

  console.log("A criar cursos e aulas...");
  const [c1, c2, c3] = await db
    .insert(courses)
    .values([
      {
        title: "Identidade com Assinatura",
        slug: "identidade-com-assinatura",
        subtitle: "Curso online",
        description: "O método completo de identidade visual premium: estratégia, sistema visual e apresentação que fecha contratos.",
        cover: "/img/curso-marca.jpg",
        level: "Intermédio",
        price: "197",
        hotmartUrl: "https://pay.hotmart.com/identidade-com-assinatura",
      },
      {
        title: "Workshop — Marca Premium em 3 Dias",
        slug: "workshop-marca-premium",
        subtitle: "Workshop intensivo",
        description: "Três dias de trabalho guiado para reposicionar a sua marca e a sua tabela de preços. Edição ao vivo com gravações incluídas.",
        cover: "/img/curso-workshop.jpg",
        level: "Todos os níveis",
        price: "89",
        hotmartUrl: "https://pay.hotmart.com/workshop-marca-premium",
      },
      {
        title: "Mentoria Design Business",
        slug: "mentoria-design-business",
        subtitle: "Programa 12 semanas",
        description: "Acompanhamento individual com sessões semanais, plano de 90 dias e suporte direto. Conteúdos de apoio disponíveis aqui na plataforma.",
        cover: "/img/curso-mentoria.jpg",
        level: "Avançado",
        price: "1800",
        hotmartUrl: "https://pay.hotmart.com/mentoria-design-business",
      },
    ])
    .returning();

  const [c1m1, c1m2, c1m3] = await db
    .insert(modules)
    .values([
      { courseId: c1.id, title: "Fundações de Marca", order: 1 },
      { courseId: c1.id, title: "Sistema Visual", order: 2 },
      { courseId: c1.id, title: "Apresentação & Entrega", order: 3 },
      { courseId: c2.id, title: "Dia 1 — Posicionamento", order: 1 },
      { courseId: c2.id, title: "Dia 2 — Identidade", order: 2 },
      { courseId: c2.id, title: "Dia 3 — Preço & Proposta", order: 3 },
      { courseId: c3.id, title: "Sessões Gravadas", order: 1 },
      { courseId: c3.id, title: "Materiais & Templates", order: 2 },
    ])
    .returning();

  const c2mods = await db.select().from(modules);
  const modByCourseOrder = (courseId: number, order: number) =>
    c2mods.find((m) => m.courseId === courseId && m.order === order)!.id;

  await db.insert(lessons).values([
    { moduleId: c1m1.id, title: "Boas-vindas e o mapa do curso", order: 1, type: "video", durationMin: 8, videoUrl: V1, content: "Bem-vinda ao Identidade com Assinatura. Nesta aula apresento a estrutura do curso, os materiais e como aproveitar ao máximo cada módulo.\n\nPrepare o seu projeto real de referência — vamos trabalhar sobre ele." },
    { moduleId: c1m1.id, title: "Posicionamento antes de pixels", order: 2, type: "video", durationMin: 24, videoUrl: V2, content: "Nenhuma identidade sobrevive sem estratégia. Vamos definir audiência, promessa e diferenciação antes de abrir qualquer software." },
    { moduleId: c1m1.id, title: "Guia de voz e personalidade de marca", order: 3, type: "material", durationMin: 15, materialUrl: "/img/curso-marca.jpg", content: "Exercício guiado: escreva a personalidade da sua marca em três adjetivos e dois nunca-serás.\n\nDescarregue o template PDF e complete o canvas de tom de voz. Este documento vai orientar todas as decisões visuais do Módulo 2." },
    { moduleId: c1m1.id, title: "Quiz — Fundações", order: 4, type: "quiz", durationMin: 10, quizDraw: 5, quizMinScore: 60, content: "5 questões sorteadas sobre estratégia e fundamentos de identidade. Em cada tentativa as questões mudam." },
    { moduleId: c1m2.id, title: "Tipografia: a voz visível", order: 1, type: "video", durationMin: 32, videoUrl: V3, content: "Como escolher e combinar famílias tipográficas que carregam a personalidade da marca — e os erros que barateiam qualquer projeto." },
    { moduleId: c1m2.id, title: "Cor com intenção", order: 2, type: "video", durationMin: 27, videoUrl: V2, content: "Psicologia, contraste e sistemas de cor flexíveis. Construímos uma paleta funcional de 60/30/10 com variações." },
    { moduleId: c1m2.id, title: "Biblioteca de componentes visuais", order: 3, type: "material", durationMin: 20, materialUrl: "/img/curso-marca.jpg", content: "Templates Figma + PDF: padrões, iconografia, texturas e sistemas de composição prontos a adaptar.\n\nPrazo sugerido: uma semana de exploração livre." },
    { moduleId: c1m3.id, title: "A apresentação que fecha contratos", order: 1, type: "video", durationMin: 29, videoUrl: V1, content: "Estrutura narrativa de uma apresentação de identidade: contexto, decisões, sistema e aplicação real. Menos slides, mais convicção." },
    { moduleId: c1m3.id, title: "Manual de marca e entrega profissional", order: 2, type: "material", durationMin: 18, materialUrl: "/img/curso-marca.jpg", content: "Checklist de entrega: ficheiros, formatos, naming e o manual de marca que o cliente realmente usa." },
    { moduleId: modByCourseOrder(c2.id, 1), title: "Diagnóstico: onde está a sua marca hoje", order: 1, type: "video", durationMin: 45, videoUrl: V3, content: "Sessão ao vivo (gravada). Auditoria guiada ao seu posicionamento atual com o canvas de diagnóstico." },
    { moduleId: modByCourseOrder(c2.id, 1), title: "Exercício do Dia 1", order: 2, type: "material", durationMin: 30, materialUrl: "/img/curso-workshop.jpg", content: "Complete o canvas de posicionamento e publique no grupo privado até às 20h para feedback." },
    { moduleId: modByCourseOrder(c2.id, 2), title: "Do conceito ao sistema visual", order: 1, type: "video", durationMin: 52, videoUrl: V2, content: "Transformar o posicionamento do Dia 1 numa linguagem visual com assinatura." },
    { moduleId: modByCourseOrder(c2.id, 2), title: "Sprint de identidade em 90 minutos", order: 2, type: "material", durationMin: 90, content: "Sprint cronometrado: moodboard final, par tipográfico e paleta. Partilhe o resultado no fórum da turma." },
    { moduleId: modByCourseOrder(c2.id, 3), title: "Tabela de preços premium", order: 1, type: "video", durationMin: 41, videoUrl: V1, content: "Como construir pacotes, ancorar valor e comunicar o preço sem hesitar." },
    { moduleId: modByCourseOrder(c2.id, 3), title: "Proposta que vende sozinha", order: 2, type: "material", durationMin: 25, materialUrl: "/img/curso-workshop.jpg", content: "Template de proposta comercial premium (PDF + Notion) com scripts de follow-up." },
    { moduleId: modByCourseOrder(c3.id, 1), title: "Sessão 1 — Diagnóstico completo (gravação)", order: 1, type: "video", durationMin: 60, videoUrl: V3, content: "Gravação da primeira sessão: o ponto de partida do seu plano de 12 semanas." },
    { moduleId: modByCourseOrder(c3.id, 1), title: "Sessão 2 — Identidade & assinatura (gravação)", order: 2, type: "video", durationMin: 60, videoUrl: V2, content: "Refinamento da linguagem visual e editorial da sua marca pessoal." },
    { moduleId: modByCourseOrder(c3.id, 2), title: "Biblioteca de templates da mentoria", order: 1, type: "material", durationMin: 10, materialUrl: "/img/curso-mentoria.jpg", content: "Todos os templates usados nas sessões: propostas, scripts de preço, calendário editorial e plano de 90 dias." },
  ]);

  // Banco de questões do quiz: cada aluna recebe 5 das 10
  const [quizLesson] = await db.select().from(lessons).where(eq(lessons.title, "Quiz — Fundações")).limit(1);
  const bank: [string, string[], number, string][] = [
    ["O que distingue uma marca premium de uma marca comum?", ["Usar dourado e preto em tudo", "Coerência estratégica entre posicionamento, linguagem e experiência", "Ter um logótipo complexo", "Publicar todos os dias nas redes"], 1, "Premium é percepção construída com coerência, não um estilo visual."],
    ["Antes de desenhar, o primeiro passo de um projeto de identidade é:", ["Escolher a tipografia", "Fazer um moodboard no Pinterest", "Diagnóstico e estratégia da marca", "Desenhar três propostas de logo"], 2, "Sem diagnóstico, as decisões visuais não têm critério."],
    ["Uma grelha tipográfica serve essencialmente para:", ["Tornar o design mais rápido de produzir", "Garantir ritmo, hierarquia e consistência visual", "Impressionar o cliente", "Usar menos espaço em branco"], 1, "A grelha organiza a informação e cria consistência entre peças."],
    ["O posicionamento de uma marca responde sobretudo a:", ["Que cores usar", "Para quem é, que promessa faz e porque é diferente", "Quanto custa o produto", "Em que redes sociais estar"], 1, "Audiência, promessa e diferenciação são a base do posicionamento."],
    ["Numa paleta 60/30/10, o 10% corresponde a:", ["A cor de fundo dominante", "A cor secundária", "A cor de destaque", "O preto do texto"], 2, "O destaque é usado com parcimónia para guiar a atenção."],
    ["Um bom guia de voz de marca define:", ["Apenas o slogan", "Personalidade, tom e o que a marca nunca diz", "A lista de hashtags", "O tamanho do logótipo"], 1, "O guia orienta toda a comunicação escrita, incluindo os limites."],
    ["Qual destes é um sinal de identidade inconsistente?", ["Mesma tipografia em todas as peças", "Cores diferentes em cada publicação sem critério", "Grelha comum nos materiais", "Tom de voz reconhecível"], 1, "A inconsistência dilui o reconhecimento da marca."],
    ["Porque se apresenta uma identidade com aplicações reais (mockups)?", ["Para encher a apresentação", "Para o cliente visualizar o sistema a funcionar no contexto dele", "Porque é obrigatório", "Para esconder o logótipo"], 1, "Ver a marca aplicada ajuda o cliente a decidir com confiança."],
    ["O manual de marca deve ser, acima de tudo:", ["Longo e detalhado ao máximo", "Prático e usado no dia a dia pela equipa do cliente", "Apenas um PDF bonito", "Secreto"], 1, "Um manual que ninguém usa não protege a marca."],
    ["Ao escolher uma família tipográfica, o critério mais importante é:", ["Estar na moda", "Ser gratuita", "Carregar a personalidade da marca e funcionar nos suportes", "Ter muitos pesos decorativos"], 2, "A tipografia é a voz visível: tem de ser coerente e funcional."],
  ];
  await db.insert(quizQuestions).values(
    bank.map(([question, options, answer, explanation], i) => ({
      lessonId: quizLesson.id,
      question,
      options,
      answer,
      explanation,
      order: i + 1,
    }))
  );

  const allLessons = await db.select().from(lessons);
  const course1Lessons = allLessons.filter((l) =>
    [c1m1.id, c1m2.id, c1m3.id].includes(l.moduleId)
  );
  const course2Lessons = allLessons.filter((l) =>
    [modByCourseOrder(c2.id, 1), modByCourseOrder(c2.id, 2), modByCourseOrder(c2.id, 3)].includes(l.moduleId)
  );

  console.log("A criar inscrições e progresso...");
  await db.insert(enrollments).values([
    { userId: sofia.id, courseId: c1.id, createdAt: daysAgo(60) },
    { userId: sofia.id, courseId: c2.id, createdAt: daysAgo(30) },
    { userId: ines.id, courseId: c2.id, createdAt: daysAgo(45) },
  ]);

  const sorted1 = [...course1Lessons].sort((a, b) => a.order - b.order);
  await db.insert(lessonProgress).values(
    sorted1.slice(0, 5).map((l, i) => ({
      userId: sofia.id,
      lessonId: l.id,
      completedAt: daysAgo(20 - i * 2),
    }))
  );
  await db.insert(lessonProgress).values(
    course2Lessons.slice(0, 2).map((l, i) => ({
      userId: ines.id,
      lessonId: l.id,
      completedAt: daysAgo(15 - i),
    }))
  );

  console.log("A criar conteúdo de marketing...");
  const p = (title: string, network: string, format: string, status: "idea" | "production" | "review" | "approved" | "published", dayOffset: number, hour = 10, copy?: string) => ({
    title,
    network,
    format,
    status,
    publishAt: daysFromNow(dayOffset, hour),
    copy: copy ?? null,
  });
  await db.insert(posts).values([
    p("Antes/depois: rebranding Estúdio Meridional", "Instagram", "Carrossel", "published", -18, 10, "O poder de um sistema visual coerente — veja a transformação completa."),
    p("3 erros que barateiam o seu portfólio", "Blog", "Artigo", "published", -12, 9),
    p("Reels: o meu processo de moodboard em 40s", "Instagram", "Reels", "published", -6, 19),
    p("Newsletter O Dossiê #24 — preço sem medo", "Email", "Newsletter", "published", -3, 8),
    p("Carrossel: anatomia de uma proposta premium", "Instagram", "Carrossel", "approved", 1, 10, "Slide a slide: como apresento um orçamento de 5 dígitos."),
    p("Tutorial: paleta 60/30/10 em 2 minutos", "TikTok", "Vídeo", "approved", 2, 18),
    p("Post LinkedIn: porque recuso clientes baratos", "LinkedIn", "Post estático", "review", 3, 9),
    p("Stories: bastidores da sessão de mentoria", "Instagram", "Stories", "production", 2, 15),
    p("Vídeo: análise de 3 portfólios de alunas", "YouTube", "Vídeo", "production", 5, 17),
    p("Reels: a tipografia que mudou tudo", "Instagram", "Reels", "idea", 6, 19),
    p("Anúncio: próxima edição do Workshop Marca Premium", "Facebook", "Post estático", "idea", 8, 10),
    p("Artigo SEO: quanto cobrar por um logótipo em 2026", "Blog", "Artigo", "idea", 10, 9),
  ]);

  console.log("A guardar definições...");
  await db.insert(settings).values([
    { key: "whatsapp_number", value: "351912345678" },
    { key: "contact_email", value: "ola@marinaloyola.com" },
  ]);

  console.log("");
  console.log("✓ Seed concluído com sucesso.");
  console.log("  Admin: marina@marinaloyola.com / marina123");
  console.log("  Aluna: sofia@email.com / aluno123");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
