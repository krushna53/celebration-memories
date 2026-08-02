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
  /**
   * IANA timezone name (e.g. "Asia/Kolkata", "America/New_York") that
   * every displayed date/time for this event is pinned to, regardless of
   * where a guest or the server happens to be — see lib/timezone.ts.
   * Auto-detected from venueAddress when possible (lib/timezone-lookup.ts),
   * always admin-overridable, defaults to "Asia/Kolkata" for any event
   * that predates this field or has no venue address yet.
   */
  timezone: string;
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
  /**
   * When true, /events/[slug]/memories is open to anyone — a single
   * shareable link relatives can use to upload photos/videos/audio
   * without a personal /invite/[token] link. Off by default. Visitors
   * identify themselves by name only (see services/public-memories.ts);
   * uploads still go through the normal approval queue before appearing
   * on the public Memory Wall.
   */
  publicMemoriesEnabled: boolean;
  /** Storage path (gallery bucket) of the organizer-chosen link-preview image. See lib/event-metadata.ts. */
  shareImagePath: string | null;
  /**
   * Storage path (gallery bucket) of an optional link-preview video
   * (og:video). Only Telegram actually plays this inline — WhatsApp,
   * Facebook, and Messenger ignore og:video entirely and always fall
   * back to shareImagePath. See lib/event-metadata.ts.
   */
  shareVideoPath: string | null;
  /**
   * Storage path (gallery bucket) of an optional, already-edited
   * "highlight reel" video — e.g. all the guest videos combined with
   * name labels using an outside editing tool, then uploaded here as
   * one finished file. Plays as its own slide on the Big Screen
   * Display (see lib/build-display-slides.ts) right after the title
   * card. This is the manual alternative to automatic in-app video
   * clubbing, which the platform doesn't do yet.
   */
  highlightReelPath: string | null;
  /** Homepage section order/visibility, admin-editable. Null = default (all sections, standard order). See lib/section-registry.ts. */
  sectionConfig: SectionConfigItem[] | null;
  /** Max AI Image generations a client-role admin may make for this event. Owner is exempt. See services/ai-image-generations.ts. */
  aiImageGenerationLimit: number;
  /** Max AI Custom CSS generations a client-role admin may make for this event. Owner is exempt. See services/ai-css-generations.ts. */
  aiCssGenerationLimit: number;
  /** Max Slideshow Video renders a client-role admin may make for this event. Owner is exempt. See services/slideshow-video-generations.ts. */
  slideshowVideoGenerationLimit: number;
  /** Max Video Editor renders a client-role admin may make for this event. Owner is exempt. See services/video-editor.ts's countVideoEditGenerations. */
  videoEditorGenerationLimit: number;
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
  /**
   * Which deliverables a self-serve wizard host wants — some subset of
   * "invitation_card" | "slideshow" | "website" — chosen on the
   * wizard's Goals step. Null for the pre-existing single production
   * event and any draft still mid-wizard. See
   * features/start/wizard-steps.ts's resolveWizardSteps for how this
   * drives which steps even appear.
   */
  wizardGoals: string[] | null;
  /**
   * Controls the event-day Schedule + Menu feature (see services/event-day.ts
   * and features/event-day):
   * - "off": feature unused, nothing shown anywhere.
   * - "public": rendered as a section on the main public event page, right
   *   after Timeline — same zero-verification model as every other section.
   * - "private": NOT shown on the main page at all. Only reachable via
   *   /event-day/[eventDayShareToken], which requires a guest to verify
   *   themselves by phone number against this event's invitee list first
   *   (same real check games/word-search and housie already do) — for
   *   hosts who don't want the run-of-show/menu visible to just anyone
   *   with the event URL.
   */
  eventDayMode: "off" | "public" | "private";
  /** Share link token for "private" mode. Null until first generated (see ensureEventDayShareToken). */
  eventDayShareToken: string | null;
  /** Whether the event-day menu is served buffet-style or à la carte — shown as a banner above the item list, doesn't change the data model. */
  menuStyle: "buffet" | "a_la_carte";
  /**
   * Whether the guest-facing AI Avatar (a chat host grounded in this
   * event's own details, plus a welcome greeting) shows on the public
   * event page. Off by default — this calls a paid AI API per message,
   * unlike the free static SupportChatWidget/FaqChatbot. See
   * lib/ai-avatar-chat.ts and features/event-avatar.
   */
  aiAvatarEnabled: boolean;
  /** Cost guard for the AI Avatar: max guest messages answered per calendar day, across all guests combined. See services/ai-avatar-messages.ts. */
  aiAvatarDailyMessageLimit: number;
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
  /** Optional, admin-set record of how this guest's invite actually reached them — see INVITE_CHANNEL_OPTIONS in lib/invite-channel.ts. Purely informational. */
  inviteChannel: string | null;
  createdAt: string;
  updatedAt: string;
}
