import "server-only";
import { NextResponse } from "next/server";

import { getEventByPlannerToken, listPlannerTasks, listPlannerNotes } from "@/services/event-planner";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated planner board for the companion mobile app.
 * Mirrors features/plan/actions.ts's requireEventByToken pattern: the
 * link token is the only thing trusted — a client-supplied eventId is
 * never accepted, same rule as every other /api/mobile/* route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getEventByPlannerToken(token);
  if (!event) {
    return NextResponse.json(
      { error: "This planning link isn't valid or has been reset. Ask the host for a new one." },
      { status: 404 },
    );
  }

  const [tasks, notes] = await Promise.all([listPlannerTasks(event.id), listPlannerNotes(event.id)]);
  return NextResponse.json({ event, tasks, notes });
}
