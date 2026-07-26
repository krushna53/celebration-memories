/**
 * Site-wide constants for the active event.
 *
 * In the multi-event architecture these values are seeded from the
 * `events` table (see /types/event.ts and /services/events.ts). They are
 * kept here as strongly-typed fallbacks so the marketing site can render
 * instantly without waiting on a database round trip, and so local
 * development works without Supabase configured.
 */
export const SITE_NAME = "Celebration Memories";

export const ACTIVE_EVENT = {
  honoreeName: "Mahesh J. Shah",
  eventTitle: "75 Years of Love",
  hostedBy: "Jagruti Shah",
  dayOfWeek: "Sunday",
  date: "August 23, 2026",
  startTime: "11:00 AM",
  endTime: "3:00 PM",
  isoStart: "2026-08-23T11:00:00+05:30",
} as const;

export const BUILDER = {
  name: "Krushna Web Works",
  whatsappUrl:
    "https://wa.me/919987982969?text=Hi%20Harshal,%20I%20visited%20your%20event%20website%20and%20would%20like%20to%20create%20something%20similar.",
} as const;

export const NAV_LINKS = [
  { label: "Home", href: "#hero" },
  { label: "Event Details", href: "#details" },
  { label: "Gallery", href: "#gallery" },
  { label: "Timeline", href: "#timeline" },
  { label: "RSVP", href: "#rsvp" },
  { label: "Memories", href: "#memories" },
] as const;
