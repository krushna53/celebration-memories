import "server-only";
import { NextResponse } from "next/server";

import { requireMobileAdmin } from "@/services/admin-mobile-auth";
import { getEventById } from "@/services/events";
import { getDashboardStats } from "@/services/admin-stats";

export const dynamic = "force-dynamic";

/**
 * Per-event stats for the Event Manager (owner) drilling into one event
 * from the list ../../overview/route.ts returned. A client-role admin
 * can also call this, but only for their own event — same
 * requireAdminForEvent-style check the web app uses everywhere else,
 * just against the mobile session's resolved admin instead of the web
 * cookie session.
 */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  let admin;
  try {
    admin = await requireMobileAdmin(request.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorized." }, { status: 401 });
  }

  if (admin.role !== "owner" && admin.eventId !== eventId) {
    return NextResponse.json({ error: "You don't have access to this event." }, { status: 403 });
  }

  const [event, stats] = await Promise.all([getEventById(eventId), getDashboardStats(eventId)]);
  if (!event) {
    return NextResponse.json({ error: "That event could not be found." }, { status: 404 });
  }

  return NextResponse.json({ event, stats });
}
