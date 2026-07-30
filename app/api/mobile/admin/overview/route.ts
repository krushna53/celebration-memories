import "server-only";
import { NextResponse } from "next/server";

import { requireMobileAdmin } from "@/services/admin-mobile-auth";
import { listAllActiveEvents, getEventById } from "@/services/events";
import { getDashboardStats } from "@/services/admin-stats";

export const dynamic = "force-dynamic";

/**
 * Landing data for the mobile app's Organiser/Event Manager home
 * screen. Shape depends on role, same split as the web dashboard:
 * - "client" (Organiser) — scoped to their one event, so this returns
 *   that event's own at-a-glance stats directly.
 * - "owner" (Event Manager) — every active event, so this returns the
 *   list; the app calls ../event/[eventId]/overview once they pick one
 *   (see that route for the per-event stats, shared with this one).
 */
export async function GET(request: Request) {
  let admin;
  try {
    admin = await requireMobileAdmin(request.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorized." }, { status: 401 });
  }

  if (admin.role === "owner") {
    const events = await listAllActiveEvents();
    return NextResponse.json({ role: "owner", events });
  }

  if (!admin.eventId) {
    return NextResponse.json(
      { error: "No event is assigned to this account yet. Contact the site owner to get linked to your event." },
      { status: 404 },
    );
  }

  const [event, stats] = await Promise.all([getEventById(admin.eventId), getDashboardStats(admin.eventId)]);
  if (!event) {
    return NextResponse.json({ error: "That event could not be found." }, { status: 404 });
  }

  return NextResponse.json({ role: "client", event, stats });
}
