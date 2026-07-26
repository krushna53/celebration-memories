import { format } from "date-fns";

import { ACTIVE_EVENT, VENUE } from "@/lib/constants";
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
    };
  }

  return {
    honoreeName: event.honoreeName,
    hostedBy: event.hostedBy,
    occasion: event.occasion,
    eventTitle: event.eventTitle,
    dayOfWeek: format(new Date(event.startAt), "EEEE"),
    date: format(new Date(event.startAt), "MMMM d, yyyy"),
    startTime: format(new Date(event.startAt), "h:mm a"),
    endTime: format(new Date(event.endAt), "h:mm a"),
    isoStart: event.startAt,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    mapsUrl: event.mapsUrl,
    mapsEmbedUrl: event.mapsEmbedUrl,
    parkingInfo: event.parkingInfo,
    dressCode: event.dressCode,
    occasionDate: event.occasionDate
      ? format(new Date(`${event.occasionDate}T00:00:00`), "MMMM d, yyyy")
      : null,
    category: event.category,
    additionalNotes: event.additionalNotes,
    wishMessage: event.wishMessage,
  };
}
