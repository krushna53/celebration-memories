import { SITE_URL } from "@/lib/constants";
import { formatEventDate, formatEventTime } from "@/lib/timezone";
import { getEventSegment } from "@/lib/event-segment";
import type { EventRecord } from "@/types/event";
import type { WhatsAppCategory } from "./types";

/**
 * Template values for EveryMoment's event notifications. Every date/time
 * goes through the event's own timezone, and every link is built from
 * the guest's own invite token, so a message can only ever point at
 * that guest's page on that event.
 */

/** "Mahesh J. Shah's 75th Birthday Celebration" for family events; the event's own name for corporate ones. */
export function eventDisplayName(event: Pick<EventRecord, "honoreeName" | "occasion" | "category">): string {
  if (getEventSegment(event.category) === "corporate") return event.honoreeName;
  return event.occasion ? `${event.honoreeName}'s ${event.occasion}` : `${event.honoreeName}'s celebration`;
}

const ATTENDANCE_TEXT: Record<string, string> = {
  coming: "Attending",
  maybe: "Maybe",
  not_coming: "Not attending",
};

type EventFields = Pick<EventRecord, "honoreeName" | "occasion" | "category" | "hostedBy" | "startAt" | "timezone" | "venueName" | "venueAddress">;

export function eventTemplateValues(event: EventFields, invitee: { name: string; token: string; rsvp_status: string }): Record<string, string> {
  const inviteUrl = `${SITE_URL}/invite/${invitee.token}`;
  return {
    guest_name: invitee.name.trim().split(/\s+/)[0] || invitee.name,
    host_name: event.hostedBy,
    event_name: eventDisplayName(event),
    event_when: `${formatEventDate(event.startAt, event.timezone)}, ${formatEventTime(event.startAt, event.timezone)}`,
    venue: [event.venueName, event.venueAddress].filter(Boolean).join(", ") || "details on your invitation",
    attendance: ATTENDANCE_TEXT[invitee.rsvp_status] ?? "Received",
    link: inviteUrl,
    memories_link: `${inviteUrl}#share`,
  };
}

/** Thank-you, photo and feedback messages link to the guest's upload/wishes section instead of the top of their invite. */
export function valuesFor(category: WhatsAppCategory, values: Record<string, string>): Record<string, string> {
  const postEvent = category === "thank_you" || category === "memory_reminder" || category === "feedback_request";
  return postEvent ? { ...values, link: values.memories_link ?? values.link ?? "" } : values;
}
