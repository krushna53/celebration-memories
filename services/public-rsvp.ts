import "server-only";

import { getEventBySlug } from "@/services/events";
import { createInvitee, listInvitees, updateInvitee } from "@/services/admin-invitees";
import type { EventRecord, InviteeRecord } from "@/types/event";

/** Strips everything but digits, so "+91 98765 43210" and "9876543210" match. */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Looks up an event by slug for the public self-service RSVP page.
 * Returns null if the event doesn't exist OR hasn't opted into public
 * RSVP — callers should show a 404 / "use your personal link" message
 * either way, without distinguishing the two (don't leak which slugs
 * exist to a guest without a legitimate link).
 */
export async function getEventForPublicRsvp(slug: string): Promise<EventRecord | null> {
  const event = await getEventBySlug(slug);
  if (!event || !event.publicRsvpEnabled) return null;
  return event;
}

export interface SelfRsvpIdentity {
  name: string;
  phone: string;
  email?: string | null;
}

/**
 * Finds an existing invitee for this event by phone number (digits-only
 * match, so formatting differences don't create duplicates), or creates
 * a new one. This is what makes the public RSVP page usable without a
 * per-guest invite link: phone number stands in for the invite token as
 * the guest's identity within one event.
 *
 * Trade-off worth knowing: because matching is phone-only, a guest who
 * mistypes someone else's number would edit that person's RSVP instead
 * of creating their own. Acceptable for a self-service opt-in flow, but
 * it's why this is off by default — see events.public_rsvp_enabled.
 */
export async function findOrCreateSelfInvitee(
  eventId: string,
  identity: SelfRsvpIdentity,
): Promise<InviteeRecord> {
  const normalized = normalizePhone(identity.phone);
  if (!normalized || normalized.length < 7) {
    throw new Error("Please enter a valid phone number.");
  }

  const existing = await listInvitees(eventId);
  const match = existing.find((inv) => inv.phone && normalizePhone(inv.phone) === normalized);

  if (match) {
    await updateInvitee(match.id, {
      name: identity.name,
      phone: match.phone,
      email: identity.email ?? match.email,
      relationship: match.relationship,
    });
    return { ...match, name: identity.name, email: identity.email ?? match.email };
  }

  return createInvitee(eventId, {
    name: identity.name,
    phone: identity.phone,
    email: identity.email ?? null,
    relationship: "Public RSVP",
  });
}
