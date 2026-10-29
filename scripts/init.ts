/**
 * Estrutura base para produção, sem dados de exemplo: fases do pipeline, tipos de sessão,
 * horário semanal, canais de origem e links da bio. Só preenche o que estiver vazio —
 * pode correr-se várias vezes sem apagar nem duplicar nada.
 *
 *   npm run db:init
 */
import "dotenv/config";
import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, pool } from "../src/db";
import { availability, bioLinks, channels, eventTypes, pipelineStages } from "../src/db/schema";

async function isEmpty(table: PgTable) {
  const [{ n }] = await db.select({ n: count() }).from(table);
  return n === 0;
}

async function step(label: string, table: PgTable, insert: () => Promise<unknown>) {
  if (await isEmpty(table)) {
    await insert();
    console.log(`✓ ${label}`);
  } else {
    console.log(`· ${label}: já existe, mantido`);
  }
}

async function main() {
  await step("Fases do pipeline", pipelineStages, () =>
    db.insert(pipelineStages).values([
      { pipeline: "mentoria", name: "Novo Lead", order: 1, color: "#71717a" },
      { pipeline: "mentoria", name: "Contactado", order: 2, color: "#0ea5e9" },
      { pipeline: "mentoria", name: "Qualificado", order: 3, color: "#a855f7" },
      { pipeline: "mentoria", name: "Proposta Enviada", order: 4, color: "#f59e0b" },
      { pipeline: "mentoria", name: "Pagamento Confirmado", order: 5, color: "#10b981" },
      { pipeline: "mentoria", name: "Cliente Ativo", order: 6, color: "#800080" },
      { pipeline: "workshops", name: "Novo Lead", order: 1, color: "#71717a" },
      { pipeline: "workshops", name: "Inscrito", order: 2, color: "#0ea5e9" },
      { pipeline: "workshops", name: "Pagamento Pendente", order: 3, color: "#f59e0b" },
      { pipeline: "workshops", name: "Confirmado", order: 4, color: "#10b981" },
      { pipeline: "workshops", name: "Concluído", order: 5, color: "#800080" },
    ])
  );

  await step("Tipos de sessão", eventTypes, () =>
    db.insert(eventTypes).values([
      {
        name: "Sessão Exploratória",
        description: "30 minutos gratuitos para mapear o seu momento e perceber se a mentoria é o próximo passo certo.",
        durationMin: 30,
        color: "#a855f7",
      },
      {
        name: "Sessão de Mentoria",
        description: "Sessão individual do programa de mentoria. Traga decisões pendentes e trabalho em curso.",
        durationMin: 60,
        color: "#800080",
      },
    ])
  );

  await step("Horário semanal (seg–sex, 09:30–18:00, almoço 13:00–14:00)", availability, () =>
    db.insert(availability).values(
      [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        dayOfWeek: d,
        startTime: "09:30",
        endTime: "18:00",
        breakStart: d >= 1 && d <= 5 ? "13:00" : null,
        breakEnd: d >= 1 && d <= 5 ? "14:00" : null,
        active: d >= 1 && d <= 5,
      }))
    )
  );

  await step("Canais de origem", channels, () =>
    db.insert(channels).values([
      { name: "BNI", color: "#c8102e" },
      { name: "CNN", color: "#1d4ed8" },
      { name: "BNEX", color: "#0f766e" },
    ])
  );

  await step("Links da bio", bioLinks, () =>
    db.insert(bioLinks).values([
      { title: "Mentoria Design Business", subtitle: "Conheça o programa de mentoria", url: "/mentoria", image: "/img/curso-mentoria.jpg", highlight: true, order: 1 },
      { title: "Sobre a Marina", subtitle: "A minha história e método", url: "/sobre", order: 2 },
      { title: "Fala comigo", subtitle: "Dúvidas, parcerias ou imprensa", url: "/contato", order: 3 },
    ])
  );

  console.log("\nEstrutura pronta. Crie a conta de administradora com: npm run db:admin -- email \"Nome\" \"palavra-passe\"");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
