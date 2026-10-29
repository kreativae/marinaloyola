import crypto from "node:crypto";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, eventTypes } from "@/db/schema";
import { buildFeed } from "@/lib/calendar";
import { readRaw } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Feed iCal secreto com os agendamentos: /api/calendar/<token>.ics
 * Subscrito no Google Calendar em "Outros calendários → A partir do URL".
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = file.replace(/\.ics$/, "");
  const stored = (await readRaw(["calendar_feed_token"])).calendar_feed_token ?? "";
  const valid =
    stored.length > 0 &&
    token.length === stored.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored));
  if (!valid) return new Response("Not found", { status: 404 });

  const rows = await db
    .select({ appt: appointments, eventName: eventTypes.name })
    .from(appointments)
    .leftJoin(eventTypes, eq(eventTypes.id, appointments.eventTypeId))
    .where(
      and(
        ne(appointments.status, "cancelled"),
        gte(appointments.startAt, new Date(Date.now() - 90 * 86_400_000))
      )
    )
    .orderBy(desc(appointments.startAt))
    .limit(1000);

  const ics = buildFeed(
    rows.map(({ appt, eventName }) => ({
      id: appt.id,
      title: `${eventName ?? "Sessão"} — ${appt.name}`,
      description: [
        `${appt.name} <${appt.email}>`,
        appt.phone,
        appt.meetingUrl ? `Link: ${appt.meetingUrl}` : null,
        appt.notes ? `Notas: ${appt.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      url: appt.meetingUrl,
      startAt: appt.startAt,
      endAt: appt.endAt,
      createdAt: appt.createdAt,
    }))
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
