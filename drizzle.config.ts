import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Usa a mesma DATABASE_URL da aplicação (local: .env; servidor: variáveis do Coolify)
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db" },
});
