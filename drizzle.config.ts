import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Usa a mesma DATABASE_URL da aplicação (local: .env; servidor: variáveis do Coolify).
// Sem ela, falha já com uma mensagem clara em vez de tentar ligar a localhost e ficar parado.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL não está definida. No Coolify: Environment Variables → DATABASE_URL (disponível em runtime) e reinicie a aplicação."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
