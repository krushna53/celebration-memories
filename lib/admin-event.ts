import "server-only";

import { getEventById } from "@/services/events";
import type { CurrentAdmin } from "@/services/admin-auth";
import type { EventRecord } from "@/types/event";

/** Customer dashboards resolve only their current membership. Platform staff use approved read-only support access. */
export async function resolveAdminEvent(admin: CurrentAdmin): Promise<EventRecord | null> {
  if (admin.role !== "owner") {
    return admin.eventId ? getEventById(admin.eventId) : null;
  }

  // Platform staff use the separate, approved read-only support screen.
  return null;
}

/** Event management requires a customer team membership. */
export function isAdminForEvent(admin: CurrentAdmin | null, eventId: string): boolean {
  if (!admin) return false;
  return admin.role !== "owner" && admin.memberships.some((m) => m.eventId === eventId);
}
