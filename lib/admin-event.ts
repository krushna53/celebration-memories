import "server-only";

import { EVENT_SLUG } from "@/lib/constants";
import { getEventById, getEventBySlug } from "@/services/events";
import type { CurrentAdmin } from "@/services/admin-auth";
import type { EventRecord } from "@/types/event";

/**
 * Resolves which event an admin should see. Every existing admin page
 * currently calls getEventBySlug(EVENT_SLUG) directly — this helper is
 * the seam for eventually replacing those calls, but as of this
 * writing it is ONLY used by the new self-serve wizard's claim flow and
 * new client-scoped admins; the existing admin dashboard pages have
 * NOT been switched over to it yet (that's the still-pending "Phase 2"
 * retrofit — see the README's "Self-Serve Onboarding Wizard" section).
 *
 * - Client-role admins with a non-null eventId (created via the wizard,
 *   see services/event-drafts.ts) always see their own event.
 * - Everyone else (every pre-existing admin, eventId null) falls back
 *   to the single EVENT_SLUG event, unchanged from today's behaviour.
 */
export async function resolveAdminEvent(admin: CurrentAdmin): Promise<EventRecord | null> {
  if (admin.eventId) {
    return getEventById(admin.eventId);
  }
  return getEventBySlug(EVENT_SLUG);
}
