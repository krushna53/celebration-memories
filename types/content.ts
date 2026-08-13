import type { GalleryCategory } from "@/features/gallery/gallery-data";

export interface GalleryPhotoRecord {
  id: string;
  eventId: string;
  category: GalleryCategory;
  url: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

/**
 * Unified shape for anything selectable as a Slideshow Video slide —
 * Gallery photos and Timeline milestone photos both get mapped into
 * this before reaching SlideshowComposer, so the composer doesn't need
 * to know about either source's other fields. See
 * app/admin/(dashboard)/slideshow/page.tsx.
 */
export interface SlideSource {
  id: string;
  url: string;
  /** Combined display caption shown in the composer's photo list, e.g. "1978 — Wedding Day". */
  caption: string | null;
  /** Main line for the Slideshow Video's on-screen caption bar — a milestone's title, or a gallery photo's caption. Null = no caption bar for this slide. */
  captionTitle: string | null;
  /** Smaller second line under captionTitle — a milestone's period (e.g. "1978"). Always null for gallery photos. */
  captionSubtitle: string | null;
}

export interface TimelineMilestoneRecord {
  id: string;
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder: number;
  /** Optional photo for this milestone — shown on the public Timeline and selectable in the Slideshow Video composer. */
  imageUrl: string | null;
  createdAt: string;
}

/** One time-blocked segment of the event-day run-of-show (see services/event-day.ts). */
export interface ScheduleItemRecord {
  id: string;
  eventId: string;
  /** Free-text display time, e.g. "11:00 AM" — not parsed/computed against, just shown in order. */
  startLabel: string;
  endLabel: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  /** When true, guests see a "Register" (or "Register & Pay") control for this session on Event Day. See features/rsvp-payment/actions.ts's initiateSessionRegistrationAction. */
  requiresRegistration: boolean;
  /** Only meaningful when requiresRegistration is true — false means registering is free (just creates a session_registrations row, no payment). */
  isPaidSession: boolean;
  regularPrice: number | null;
  earlyBirdPrice: number | null;
  earlyBirdDeadline: string | null;
  currency: string;
  createdAt: string;
  /** Guest-facing link for JUST this session (#106) — /session/[shareToken] — distinct from the event's own /event-day/[token] link. Null until first generated (ensureSessionShareToken). */
  shareToken: string | null;
  /** Optional link to a Custom Form Builder form (#106) for extra registration questions beyond name/phone — reuses the standalone form system rather than a dedicated field mechanism. Null = no extra questions. */
  customFormId: string | null;
}

export type MenuDietaryTag = "veg" | "non_veg" | "vegan" | "jain";
export type MenuStyle = "buffet" | "a_la_carte";

/** One dish on the event-day menu, grouped for display by `category` (see services/event-day.ts). */
export interface MenuItemRecord {
  id: string;
  eventId: string;
  category: string;
  name: string;
  description: string | null;
  dietaryTag: MenuDietaryTag | null;
  sortOrder: number;
  createdAt: string;
}
