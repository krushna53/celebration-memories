import "server-only";

import { getEventBySlug } from "@/services/events";
import { createInvitee, listInvitees } from "@/services/admin-invitees";
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

/** Publicly supplied contact information is not proof of identity.
 * Existing guests must use their personal invitation or a verified sign-in.
 * Never return or mutate a matching row from this unauthenticated path.
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
    throw new Error("Please use your personal invitation or verified sign-in to update an RSVP.");
  }

  return createInvitee(eventId, {
    name: identity.name,
    phone: identity.phone,
    email: identity.email ?? null,
    relationship: "Public RSVP",
  });
}
