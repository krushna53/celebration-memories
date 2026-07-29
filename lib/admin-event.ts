import "server-only";

import { EVENT_SLUG } from "@/lib/constants";
import { getEventById, getEventBySlug } from "@/services/events";
import { getActiveEventOverrideId } from "@/lib/admin-active-event";
import type { CurrentAdmin } from "@/services/admin-auth";
import type { EventRecord } from "@/types/event";

/**
 * Resolves which event an admin should see. Every admin dashboard page
 * (Overview, Event Settings, Gallery, Timeline, Memories, Templates,
 * AI Image, Slideshow, Share Image, Domain Search, Invitees, Check-In)
 * calls this instead of hardcoding getEventBySlug(EVENT_SLUG) — that
 * was the previously-pending "Phase 2" retrofit; it's now done.
 *
 * - Client-role admins with a non-null eventId (created via the wizard,
 *   or via an event-scoped /admin/register?event=<id> link — see
 *   app/admin/register/page.tsx) always see their own event — the
 *   override below never applies to them, by design: a client should
 *   never be able to browse into someone else's event.
 * - Client-role admins with NO eventId get NO event (null), full stop.
 *   This used to fall back to the single EVENT_SLUG flagship event,
 *   which meant *any* client-role admin missing an eventId — including
 *   anyone who ever signed up through the old unscoped /admin/register
 *   flow, before it required an event — landed on the real production
 *   event's Gallery/Timeline/Settings/etc. with full edit access. That
 *   was a genuine cross-client data leak (confirmed: 3 real accounts
 *   were affected before this fix), not just a theoretical one — never
 *   restore this fallback for client-role admins.
 * - Owner-role admins can "step into" managing any one client's event
 *   from /admin/events (see features/admin/events/actions.ts's
 *   setActiveAdminEventAction) — that selection is read here via a
 *   per-browser cookie (lib/admin-active-event.ts). With no active
 *   selection, the owner falls back to the single EVENT_SLUG event —
 *   this part is intentional and unchanged: the owner account is
 *   trusted with every event by definition, so there's no leak here.
 */
export async function resolveAdminEvent(admin: CurrentAdmin): Promise<EventRecord | null> {
  if (admin.eventId) {
    return getEventById(admin.eventId);
  }

  if (admin.role !== "owner") {
    return null;
  }

  const overrideId = await getActiveEventOverrideId();
  if (overrideId) {
    const overridden = await getEventById(overrideId);
    if (overridden) return overridden;
  }

  return getEventBySlug(EVENT_SLUG);
}

/**
 * Whether `admin` is allowed to manage the given event — the owner can
 * manage any event; a client can only manage the one event scoped to
 * their own admins.eventId (never null-fallback to the flagship event,
 * see resolveAdminEvent's doc comment above for why that matters).
 * A non-throwing boolean sibling of requireAdminForEvent
 * (services/admin-auth.ts), for page components that should just skip
 * rendering an admin-only affordance — e.g. the template switcher on
 * the public RSVP page — rather than error out for a normal visitor.
 */
export function isAdminForEvent(admin: CurrentAdmin | null, eventId: string): boolean {
  if (!admin) return false;
  return admin.role === "owner" || admin.eventId === eventId;
}
