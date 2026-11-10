import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getEventById } from "@/services/events";
import { getActiveEventOverrideId } from "@/lib/admin-active-event";
import { isReviewerPathAllowed } from "@/lib/admin-roles";
import type { CurrentAdmin } from "@/services/admin-auth";
import type { EventRecord } from "@/types/event";

/**
 * Customer dashboards resolve only their current membership. Platform staff use approved read-only
 * support access — except for events the platform account owns itself, opened with Manage on All Events.
 */
export async function resolveAdminEvent(admin: CurrentAdmin): Promise<EventRecord | null> {
  // A reviewer may only open REVIEWER_ALLOWED_PATHS; every dashboard page resolves its event
  // here, so this one check covers them all (x-event-request-path is set by middleware, never trusted from the client).
  if (admin.role === "reviewer") {
    const path = (await headers()).get("x-event-request-path") ?? "";
    if (!isReviewerPathAllowed(path)) redirect("/admin");
  }
  if (admin.role !== "owner") {
    return admin.eventId ? getEventById(admin.eventId) : null;
  }

  const chosen = await getActiveEventOverrideId().catch(() => null);
  if (chosen && admin.ownedEventIds.includes(chosen)) return getEventById(chosen);
  // Platform staff use the separate, approved read-only support screen.
  return null;
}

/** Event management requires a customer team membership, or (platform account) owning the event. */
export function isAdminForEvent(admin: CurrentAdmin | null, eventId: string): boolean {
  if (!admin) return false;
  if (admin.role === "owner") return admin.ownedEventIds.includes(eventId);
  return admin.memberships.some((m) => m.eventId === eventId);
}
