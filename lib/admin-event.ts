import "server-only";

import { getEventById } from "@/services/events";
import { getActiveEventOverrideId } from "@/lib/admin-active-event";
import type { CurrentAdmin } from "@/services/admin-auth";
import type { EventRecord } from "@/types/event";

/**
 * Customer dashboards resolve only their current membership. Platform staff use approved read-only
 * support access — except for events the platform account owns itself, opened with Manage on All Events.
 */
export async function resolveAdminEvent(admin: CurrentAdmin): Promise<EventRecord | null> {
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
