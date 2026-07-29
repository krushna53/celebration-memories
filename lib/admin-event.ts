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
 *   see services/event-drafts.ts) always see their own event — the
 *   override below never applies to them, by design: a client should
 *   never be able to browse into someone else's event.
 * - Owner-role admins can "step into" managing any one client's event
 *   from /admin/events (see features/admin/events/actions.ts's
 *   setActiveAdminEventAction) — that selection is read here via a
 *   per-browser cookie (lib/admin-active-event.ts).
 * - Everyone else (owner with no active selection) falls back to the
 *   single EVENT_SLUG event, unchanged from the original behaviour.
 */
export async function resolveAdminEvent(admin: CurrentAdmin): Promise<EventRecord | null> {
  if (admin.eventId) {
    return getEventById(admin.eventId);
  }

  if (admin.role === "owner") {
    const overrideId = await getActiveEventOverrideId();
    if (overrideId) {
      const overridden = await getEventById(overrideId);
      if (overridden) return overridden;
    }
  }

  return getEventBySlug(EVENT_SLUG);
}
