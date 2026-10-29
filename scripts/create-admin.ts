/**
 * Cria (ou actualiza a palavra-passe de) uma conta de administradora — para o primeiro acesso
 * em produção, onde não se deve correr o seed (apaga os dados e cria contas de exemplo).
 *
 *   npm run db:admin -- email@dominio.com "Nome" "palavra-passe"
 */
import "dotenv/config";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";

// Mesmo formato de src/lib/auth.ts (salt:hash com scrypt)
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Uso: npm run db:admin -- email@dominio.com "Nome" "palavra-passe"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("A palavra-passe tem de ter pelo menos 8 caracteres.");
    process.exit(1);
  }
  const normalized = email.trim().toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (existing) {
    await db.update(users).set({ name, role: "admin", passwordHash: hashPassword(password) }).where(eq(users.id, existing.id));
    console.log(`✓ Conta ${normalized} actualizada (administradora).`);
  } else {
    await db.insert(users).values({ email: normalized, name, role: "admin", passwordHash: hashPassword(password) });
    console.log(`✓ Conta ${normalized} criada (administradora).`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
