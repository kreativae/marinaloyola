import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";

/** Cores atribuídas por ordem aos canais novos. */
const PALETTE = ["#c8102e", "#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be185d", "#15803d", "#0369a1"];

export async function listChannels() {
  return db.select().from(channels).orderBy(asc(channels.name));
}

/** Devolve o id do canal com este nome (sem distinguir maiúsculas), criando-o se não existir. */
export async function ensureChannel(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  const [found] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(sql`lower(${channels.name}) = ${clean.toLowerCase()}`)
    .limit(1);
  if (found) return found.id;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(channels);
  const [row] = await db
    .insert(channels)
    .values({ name: clean, color: PALETTE[n % PALETTE.length] })
    .onConflictDoNothing()
    .returning({ id: channels.id });
  if (row) return row.id;
  const [again] = await db.select({ id: channels.id }).from(channels).where(sql`${channels.name} = ${clean}`).limit(1);
  return again.id;
}
