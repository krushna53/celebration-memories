import { ACTIVE_EVENT, VENUE } from "@/lib/constants";
import { DEFAULT_EVENT_TIMEZONE, formatCalendarDate, formatEventTime } from "@/lib/timezone";
import type { EventRecord, EventCategory } from "@/types/event";

/**
 * Flat, display-ready shape consumed by every public-site section (Hero,
 * Countdown, Invitation, Event Details). Centralising the DB-row → view
 * mapping here means each section takes one `data` prop instead of a
 * dozen individually-threaded fields.
 *
 * Falls back to lib/constants.ts when there's no event row yet (e.g.
 * Supabase unreachable, or local dev without a database) — the public
 * site always renders something reasonable rather than crashing.
 */
export interface EventDisplayData {
  honoreeName: string;
  hostedBy: string;
  occasion: string | null;
  eventTitle: string;
  dayOfWeek: string;
  date: string;
  startTime: string;
  endTime: string;
  isoStart: string;
  venueName: string | null;
  venueAddress: string | null;
  mapsUrl: string | null;
  mapsEmbedUrl: string | null;
  parkingInfo: string | null;
  dressCode: string | null;
  /** The actual date being honoured, formatted, if it differs from the celebration date. */
  occasionDate: string | null;
  category: EventCategory | null;
  additionalNotes: string | null;
  wishMessage: string | null;
  /** IANA timezone every field above is pinned to — see lib/timezone.ts. */
  timezone: string;
}

/** Just the weekday/date parts, in the given event timezone — used to split formatEventDate's combined string into EventDisplayData's separate dayOfWeek/date fields. */
function zonedPart(iso: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...options }).format(new Date(iso));
}

export function toEventDisplayData(event: EventRecord | null): EventDisplayData {
  if (!event) {
    return {
      honoreeName: ACTIVE_EVENT.honoreeName,
      hostedBy: ACTIVE_EVENT.hostedBy,
      occasion: null,
      eventTitle: ACTIVE_EVENT.eventTitle,
      dayOfWeek: ACTIVE_EVENT.dayOfWeek,
      date: ACTIVE_EVENT.date,
      startTime: ACTIVE_EVENT.startTime,
      endTime: ACTIVE_EVENT.endTime,
      isoStart: ACTIVE_EVENT.isoStart,
      venueName: VENUE.name,
      venueAddress: VENUE.address,
      mapsUrl: VENUE.mapsDirectionsUrl,
      mapsEmbedUrl: VENUE.mapsEmbedUrl,
      parkingInfo: VENUE.parkingInfo,
      dressCode: VENUE.dressCode,
      occasionDate: null,
      category: null,
      additionalNotes: null,
      wishMessage: null,
      timezone: DEFAULT_EVENT_TIMEZONE,
    };
  }

  const timezone = event.timezone || DEFAULT_EVENT_TIMEZONE;

  return {
    honoreeName: event.honoreeName,
    hostedBy: event.hostedBy,
    occasion: event.occasion,
    eventTitle: event.eventTitle,
    // Previously used date-fns's bare format(), which renders in the
    // *server's* local zone (Netlify: UTC) — not this event's own
    // timezone. Fixed to always format in the venue's actual zone.
    dayOfWeek: zonedPart(event.startAt, timezone, { weekday: "long" }),
    date: zonedPart(event.startAt, timezone, { month: "long", day: "numeric", year: "numeric" }),
    startTime: formatEventTime(event.startAt, timezone),
    endTime: formatEventTime(event.endAt, timezone),
    isoStart: event.startAt,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    mapsUrl: event.mapsUrl,
    mapsEmbedUrl: event.mapsEmbedUrl,
    parkingInfo: event.parkingInfo,
    dressCode: event.dressCode,
    occasionDate: event.occasionDate ? formatCalendarDate(event.occasionDate) : null,
    category: event.category,
    additionalNotes: event.additionalNotes,
    wishMessage: event.wishMessage,
    timezone,
  };
}
