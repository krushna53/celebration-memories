/**
 * Core domain types for the multi-event platform.
 *
 * These mirror the `events` / `invitees` tables (see CLAUDE.md →
 * Database, plus supabase/migrations/0004_content_management.sql for
 * the admin-editable fields added on top of the Phase 3 schema).
 */

import type { SectionConfigItem } from "@/lib/section-registry";

export type EventCategory =
  | "birthday"
  | "wedding"
  | "anniversary"
  | "retirement"
  | "baby_shower"
  | "corporate"
  | "obituary"
  | "workshop"
  | "education"
  | "live_stream";

export interface EventRecord {
  id: string;
  slug: string;
  category: EventCategory;
  /** Free-text label shown prominently, e.g. "75th Birthday Celebration". */
  occasion: string | null;
  /** Slug into lib/templates.ts ALL_TEMPLATES — which visual template renders this event. */
  templateSlug: string;
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
  /**
   * The actual date being honoured (e.g. real birthdate/anniversary
   * date) — optional, and may differ from startAt/endAt, which is when
   * the celebration itself is held. YYYY-MM-DD or null.
   */
  occasionDate: string | null;
  dressCode: string | null;
  heroVideoUrl: string | null;
  /** Controls whether this event appears in the public /events directory. Direct links always work regardless. */
  visibility: "public" | "private";
  /** One or two lines shown on the /events directory card. */
  shortDescription: string | null;
  /**
   * WhatsApp invite message wording, with {{name}}, {{link}}, {{hostedBy}},
   * {{honoreeName}} placeholders. Null = use the built-in default wording
   * (see lib/whatsapp.ts).
   */
  inviteMessageTemplate: string | null;
  /**
   * When true, /events/[slug]/rsvp is open to anyone — a self-service
   * RSVP form for hosts who can't send a unique link to every guest.
   * Off by default: RSVP stays locked to personal /invite/[token] links.
   */
  publicRsvpEnabled: boolean;
  /** Storage path (gallery bucket) of the organizer-chosen link-preview image. See lib/event-metadata.ts. */
  shareImagePath: string | null;
  /**
   * Storage path (gallery bucket) of an optional link-preview video
   * (og:video). Only Telegram actually plays this inline — WhatsApp,
   * Facebook, and Messenger ignore og:video entirely and always fall
   * back to shareImagePath. See lib/event-metadata.ts.
   */
  shareVideoPath: string | null;
  /** Homepage section order/visibility, admin-editable. Null = default (all sections, standard order). See lib/section-registry.ts. */
  sectionConfig: SectionConfigItem[] | null;
  /** Max AI Image generations a client-role admin may make for this event. Owner is exempt. See services/ai-image-generations.ts. */
  aiImageGenerationLimit: number;
  /** Max AI Custom CSS generations a client-role admin may make for this event. Owner is exempt. See services/ai-css-generations.ts. */
  aiCssGenerationLimit: number;
  /** Max Slideshow Video renders a client-role admin may make for this event. Owner is exempt. See services/slideshow-video-generations.ts. */
  slideshowVideoGenerationLimit: number;
  /** Short free-text notices ("No gifts please", "Dress code: formal"), shown in Event Details. One per line, admin-editable. */
  additionalNotes: string | null;
  /** Free-text message shown in its own homepage section (default: below RSVP) — heading adapts to `category`, see lib/event-category.ts. */
  wishMessage: string | null;
  /**
   * Client-safe custom CSS for this event's public page only —
   * deliberately CSS-only, never JS (see lib/custom-css.ts for why and
   * what's blocked). Validated both on save and again at render time.
   */
  customCss: string | null;
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
  /** When the admin last tapped Send/WhatsApp for this guest — a "sent from here" marker, not a delivery receipt. */
  inviteSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}
