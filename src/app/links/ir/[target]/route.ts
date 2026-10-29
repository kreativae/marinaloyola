import { NextResponse } from "next/server";
import { db } from "@/db";
import { bioEvents } from "@/db/schema";
import { resolveTarget } from "@/lib/bio";

export const dynamic = "force-dynamic";

/** Conta o clique e segue para o destino (só destinos conhecidos: links, cursos, agendar, redes). */
export async function GET(req: Request, { params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  const url = await resolveTarget(target);
  if (!url) return NextResponse.redirect(new URL("/links", req.url));
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  if (!preview) {
    await db
      .insert(bioEvents)
      .values({ kind: "click", target, referrer: req.headers.get("referer")?.slice(0, 300) ?? null })
      .catch(() => undefined);
  }
  return NextResponse.redirect(url.startsWith("/") ? new URL(url, req.url) : url, 302);
}
