/**
 * Dados fictícios do financeiro para novembro: recebimentos (Hotmart, mentorias em parcelas,
 * sessões avulsas, pendentes e um reembolso) e despesas (mensais e pontuais) do mês todo.
 *
 * Usa os contactos que já existem. Só acrescenta; guarda os ids em "demo_novembro_ids":
 *
 *   npx tsx scripts/demo-novembro.ts             cria os dados
 *   npx tsx scripts/demo-novembro.ts --remover   apaga só o que este script criou
 */
import "dotenv/config";
import crypto from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { contacts, expenses, payments, settings } from "../src/db/schema";

const KEY = "demo_novembro_ids";
type Stored = { payments: number[]; expenses: number[]; contacts: number[]; at: string };

let seed = 20261102;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const YEAR = 2026;
/** Dia de novembro às horas indicadas (hora de Lisboa, o fuso do servidor). */
const nov = (day: number, h = 10, m = 0) => new Date(YEAR, 10, day, h, m, 0, 0);

async function remove() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (!row) return console.log("Não há dados de novembro para remover.");
  const s = JSON.parse(row.value) as Stored;
  if (s.payments.length) await db.delete(payments).where(inArray(payments.id, s.payments));
  if (s.expenses.length) await db.delete(expenses).where(inArray(expenses.id, s.expenses));
  if (s.contacts.length) await db.delete(contacts).where(inArray(contacts.id, s.contacts));
  await db.delete(settings).where(eq(settings.key, KEY));
  console.log(`✓ Removidos ${s.payments.length} recebimentos, ${s.expenses.length} despesas e ${s.contacts.length} contactos.`);
}

async function create() {
  const [exists] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (exists) return console.log("Os dados de novembro já existem. Use --remover primeiro para os recriar.");

  // Contactos: os existentes; se houver poucos, cria alguns fictícios (também removidos depois)
  let people = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(asc(contacts.id)).limit(40);
  const createdContacts: number[] = [];
  if (people.length < 8) {
    const extra = ["Leonor Faria", "Matilde Sousa", "Bianca Ferraz", "Vitória Lacerda", "Alice Moura", "Helena Pires", "Clara Neves", "Rafaela Dias"];
    const rows = await db
      .insert(contacts)
      .values(extra.map((name) => ({ name, email: `${name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(" ", ".")}@exemplo.pt`, source: "manual" as const, status: "client" as const })))
      .returning({ id: contacts.id, name: contacts.name });
    createdContacts.push(...rows.map((r) => r.id));
    people = [...people, ...rows];
  }
  let next = 0;
  const who = () => people[next++ % people.length].id;

  type Pay = typeof payments.$inferInsert;
  const pay: Pay[] = [];
  const paid = (day: number, h: number, product: string, amount: number, method: Pay["method"], ref: string, extra: Partial<Pay> = {}) =>
    pay.push({ contactId: who(), product, amount: amount.toFixed(2), method, status: method === "hotmart" ? "confirmed" : "completed", reference: ref, paidAt: nov(day, h, int(0, 3) * 15), createdAt: nov(day, h), ...extra });

  // Vendas Hotmart ao longo do mês (pico com o lançamento do workshop a meio do mês)
  const hotmartDays = [1, 2, 4, 5, 7, 9, 11, 12, 13, 13, 14, 15, 15, 16, 18, 20, 22, 24, 26, 27, 28, 30];
  for (const d of hotmartDays) {
    const curso = rnd() < 0.5;
    paid(d, int(9, 22), curso ? "Curso Identidade com Assinatura" : "Workshop — Marca Premium", curso ? 197 : 89, "hotmart", `HP${int(10000000, 99999999)}`);
  }

  // Mentorias: uma a pronto e duas em parcelas (a primeira parcela cai em novembro)
  paid(3, 15, "Mentoria Design Business", 1800, "transfer", `TRF-${int(1000, 9999)}`);
  for (const [day, total, parts, method] of [
    [6, 1800, 3, "mbway"],
    [19, 2700, 2, "transfer"],
  ] as const) {
    const plan = crypto.randomUUID();
    const contactId = who();
    for (let i = 0; i < parts; i++) {
      const due = new Date(YEAR, 10 + i, day, 12);
      const isPaid = i === 0;
      pay.push({
        contactId,
        product: "Mentoria Design Business",
        amount: (Math.round((total / parts) * 100) / 100).toFixed(2),
        method,
        status: isPaid ? "completed" : "pending",
        reference: isPaid ? `${method === "mbway" ? "MBW" : "TRF"}-${int(1000, 9999)}` : null,
        paidAt: isPaid ? due : null,
        dueDate: isPaid ? null : due,
        installment: i + 1,
        installments: parts,
        planRef: plan,
        createdAt: nov(day, 11),
      });
    }
  }

  // Sessões avulsas e workshop para empresa
  paid(8, 18, "Sessão Avulsa", 120, "mbway", `MBW-${int(10000, 99999)}`);
  paid(17, 11, "Sessão Avulsa", 120, "mbway", `MBW-${int(10000, 99999)}`);
  paid(21, 16, "Workshop in-company", 890, "transfer", `TRF-${int(1000, 9999)}`, { notes: "Equipa de marketing, 8 pessoas" });
  paid(25, 10, "Revisão de portefólio", 75, "other", `REC-${int(100, 999)}`);

  // Por receber, reembolso e cancelamento
  pay.push(
    { contactId: who(), product: "Workshop — Marca Premium", amount: "89.00", method: "mbway", status: "pending", dueDate: nov(10, 12), createdAt: nov(5, 9) },
    { contactId: who(), product: "Sessão Avulsa", amount: "120.00", method: "transfer", status: "pending", dueDate: nov(29, 12), createdAt: nov(23, 14) },
    { contactId: who(), product: "Workshop in-company", amount: "1250.00", method: "transfer", status: "pending", dueDate: nov(30, 12), createdAt: nov(20, 10), notes: "Proposta aceite, fatura emitida" },
    { contactId: who(), product: "Curso Identidade com Assinatura", amount: "197.00", method: "hotmart", status: "refunded", reference: `HP${int(10000000, 99999999)}`, createdAt: nov(9, 21), notes: "Pedido de reembolso dentro da garantia" },
    { contactId: who(), product: "Sessão Avulsa", amount: "120.00", method: "other", status: "cancelled", createdAt: nov(14, 13) }
  );

  // Despesas: mensais, impostos e pontuais (inclui o investimento no lançamento)
  type Exp = typeof expenses.$inferInsert;
  const exp: Exp[] = [
    { description: "Adobe Creative Cloud", category: "Software & ferramentas", amount: "59.99", supplier: "Adobe", recurring: true, date: nov(3) },
    { description: "Figma Professional", category: "Software & ferramentas", amount: "15.00", supplier: "Figma", recurring: true, date: nov(4) },
    { description: "Zoom Pro", category: "Software & ferramentas", amount: "13.99", supplier: "Zoom", recurring: true, date: nov(5) },
    { description: "Notion Plus", category: "Software & ferramentas", amount: "9.50", supplier: "Notion", recurring: true, date: nov(6) },
    { description: "Contabilista certificado", category: "Contabilidade & serviços", amount: "120.00", supplier: "Gabinete Silva & Reis", recurring: true, date: nov(8) },
    { description: "Cowork Lisboa — secretária fixa", category: "Espaço & deslocações", amount: "180.00", supplier: "Second Home", recurring: true, date: nov(1) },
    { description: "Anúncios Instagram — lançamento do workshop", category: "Marketing & publicidade", amount: "380.00", supplier: "Meta", date: nov(10) },
    { description: "Anúncios Instagram — remarketing", category: "Marketing & publicidade", amount: "145.00", supplier: "Meta", date: nov(18) },
    { description: "Taxas Hotmart", category: "Taxas (Hotmart, banco)", amount: "211.40", supplier: "Hotmart", date: nov(30, 18) },
    { description: "Comissões bancárias", category: "Taxas (Hotmart, banco)", amount: "8.75", supplier: "Millennium BCP", date: nov(30, 17) },
    { description: "Pagamento por conta IRS", category: "Impostos", amount: "410.00", supplier: "Autoridade Tributária", date: nov(20) },
    { description: "Segurança Social", category: "Impostos", amount: "115.00", supplier: "Segurança Social", date: nov(20, 11) },
    { description: "Sessão fotográfica para o lançamento", category: "Marketing & publicidade", amount: "320.00", supplier: "Estúdio Luz", date: nov(7) },
    { description: "Comboio Lisboa–Porto (workshop in-company)", category: "Espaço & deslocações", amount: "62.40", supplier: "CP", date: nov(21, 8) },
    { description: "Tablet gráfico Wacom", category: "Equipamento", amount: "289.00", supplier: "Worten", date: nov(12) },
    { description: "Masterclass de vendas online", category: "Formação", amount: "97.00", date: nov(15) },
    { description: "Material impresso para workshop", category: "Outros", amount: "48.60", supplier: "Papelaria Fernandes", date: nov(19) },
  ];

  const p = await db.insert(payments).values(pay).returning({ id: payments.id });
  const e = await db.insert(expenses).values(exp).returning({ id: expenses.id });
  const stored: Stored = { payments: p.map((r) => r.id), expenses: e.map((r) => r.id), contacts: createdContacts, at: new Date().toISOString() };
  await db.insert(settings).values({ key: KEY, value: JSON.stringify(stored) });

  const received = pay.filter((x) => x.status === "confirmed" || x.status === "completed").reduce((s, x) => s + Number(x.amount), 0);
  const spent = exp.reduce((s, x) => s + Number(x.amount), 0);
  console.log(`✓ ${p.length} recebimentos e ${e.length} despesas em novembro.`);
  console.log(`  Recebido: ${received.toFixed(2)} € · Despesas: ${spent.toFixed(2)} € · Lucro: ${(received - spent).toFixed(2)} €`);
}

(process.argv.includes("--remover") ? remove() : create())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
