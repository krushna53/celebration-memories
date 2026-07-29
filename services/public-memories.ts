import "server-only";

import { getEventBySlug } from "@/services/events";
import { createInvitee } from "@/services/admin-invitees";
import type { EventRecord, InviteeRecord } from "@/types/event";

/**
 * Looks up an event by slug for the public "share a memory" upload page.
 * Returns null if the event doesn't exist OR hasn't opted into public
 * memory uploads — callers should show the same guidance either way
 * (don't leak which slugs exist to a visitor without a legitimate link).
 * Mirrors services/public-rsvp.ts's getEventForPublicRsvp.
 */
export async function getEventForPublicMemories(slug: string): Promise<EventRecord | null> {
  const event = await getEventBySlug(slug);
  if (!event || !event.publicMemoriesEnabled) return null;
  return event;
}

/**
 * Mints a fresh invitee for a relative arriving via the public, no-token
 * "share a memory" link. Deliberately name-only and always creates a new
 * row (no phone-based matching like findOrCreateSelfInvitee/public RSVP) —
 * this page exists specifically to remove friction for someone who just
 * wants to upload one video, so it doesn't ask for anything but a name.
 * The new invitee's token is what lets uploads reuse the exact same
 * MediaUploadsSection / upload actions / moderation queue as a normal
 * personal invite link (see features/uploads).
 *
 * Trade-off worth knowing: since there's no de-duplication, one relative
 * visiting twice creates two invitee rows. That's fine here — the invitee
 * record only exists to carry an upload token.
 *
 * Deliberately does NOT set `relationship` — the Memory Wall shows
 * `invitees.name`/`relationship` publicly under every card (see
 * services/memory-wall.ts's `author` field and MemoryCard), so tagging
 * this with an internal label like "Public Memory Upload" would leak
 * onto the public page as e.g. "Priya · Public Memory Upload". Admins
 * can still tell these apart in the Invitees list by the lack of a
 * phone/email, which real invitees normally have.
 */
export async function createPublicMemoryUploader(
  eventId: string,
  name: string,
): Promise<InviteeRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Please enter your name.");
  }

  return createInvitee(eventId, { name: trimmed });
}
