/**
 * Core domain types for the multi-event platform.
 *
 * These mirror the `events` / `invitees` tables (see CLAUDE.md →
 * Database, plus supabase/migrations/0004_content_management.sql for
 * the admin-editable fields added on top of the Phase 3 schema).
 */

export type EventCategory =
  | "birthday"
  | "wedding"
  | "anniversary"
  | "retirement"
  | "baby_shower"
  | "corporate";

export interface EventRecord {
  id: string;
  slug: string;
  category: EventCategory;
  /** Free-text label shown prominently, e.g. "75th Birthday Celebration". */
  occasion: string | null;
  honoreeName: string;
  /** Poetic tagline shown under the honoree name, e.g. "75 Years of Love". */
  eventTitle: string;
  hostedBy: string;
  venueName: string | null;
  venueAddress: string | null;
  /** Google Maps "Get Directions" link. */
  mapsUrl: string | null;
  /** Google Maps embeddable iframe src URL. */
  mapsEmbedUrl: string | null;
  parkingInfo: string | null;
  startAt: string; // ISO timestamp
  endAt: string; // ISO timestamp
  dressCode: string | null;
  heroVideoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RsvpStatus = "pending" | "coming" | "maybe" | "not_coming";

export interface InviteeRecord {
  id: string;
  eventId: string;
  token: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  openedAt: string | null;
  lastOpenedAt: string | null;
  visitCount: number;
  rsvpStatus: RsvpStatus;
  checkedIn: boolean;
  createdAt: string;
  updatedAt: string;
}
