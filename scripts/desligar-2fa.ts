/**
 * Desliga a verificação em dois passos de uma conta — último recurso para quem perdeu o telemóvel
 * e os códigos de recuperação (corre no Terminal da aplicação no Coolify).
 *
 *   npm run db:2fa-off -- email@dominio.com
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: npm run db:2fa-off -- email@dominio.com");
    process.exit(1);
  }
  const rows = await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecovery: null })
    .where(eq(users.email, email))
    .returning({ id: users.id });
  console.log(rows.length ? `✓ Verificação em dois passos desligada em ${email}.` : `Não existe nenhuma conta com o email ${email}.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
