/**
 * Core domain types for the multi-event platform.
 *
 * These mirror the `events` / `invitees` tables introduced in Phase 3
 * (see CLAUDE.md → Database). Kept here ahead of the Supabase schema so
 * Phase 1 components (constants, hero) are already typed against the
 * eventual data model instead of ad-hoc shapes.
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
  honoreeName: string;
  eventTitle: string;
  hostedBy: string;
  venueName: string | null;
  venueAddress: string | null;
  mapsUrl: string | null;
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
