import { CHAPTERS, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { EventCategory } from "@/types/event";

/**
 * The top-level split the wizard asks about first: is this a family /
 * personal celebration, or a corporate / professional event?
 *
 * A segment is NOT stored — it's derived from `events.category`, so
 * every existing event keeps working unchanged and there's no new
 * column to keep in sync. The segment only decides:
 *
 *   - which occasions the wizard's Occasion step offers (SEGMENT_OCCASIONS),
 *   - the wording of the shared homepage sections (SEGMENT_COPY),
 *   - the default gallery chapter names a new corporate event starts
 *     with (seeded into the existing events.gallery_chapter_titles, so
 *     the gallery itself needs no corporate-specific code).
 *
 * Every feature (RSVP, check-in, uploads, games, Event Day, reels,
 * analytics…) is the same code for both segments — only copy and
 * defaults differ. Adding a segment-specific wording is one entry here,
 * never an `if (corporate)` inside a component.
 */
export type EventSegment = "family" | "corporate";

const CORPORATE_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>(["corporate", "workshop"]);

export function getEventSegment(category: EventCategory | null | undefined): EventSegment {
  return category && CORPORATE_CATEGORIES.has(category) ? "corporate" : "family";
}

/**
 * One tile on the Occasion step. Several corporate tiles share the
 * stored `corporate` category and differ only by the free-text
 * `occasion` label they prefill ("Annual Day", "Conference"…) — that
 * gives corporate hosts specific choices without adding enum values.
 */
export interface OccasionOption {
  /** Stable id, also the icon key in features/start/occasion-picker.tsx. */
  id: string;
  label: string;
  category: EventCategory;
  /** Prefilled into events.occasion when picked; null leaves the host's own text alone. */
  occasion: string | null;
}

export const SEGMENT_OCCASIONS: Record<EventSegment, OccasionOption[]> = {
  family: [
    { id: "birthday", label: "Birthday", category: "birthday", occasion: null },
    { id: "wedding", label: "Wedding", category: "wedding", occasion: null },
    { id: "anniversary", label: "Anniversary", category: "anniversary", occasion: null },
    { id: "retirement", label: "Retirement", category: "retirement", occasion: null },
    { id: "baby_shower", label: "Baby Shower", category: "baby_shower", occasion: null },
    { id: "reunion", label: "Reunion", category: "reunion", occasion: null },
    { id: "education", label: "Educational Event", category: "education", occasion: null },
    { id: "live_stream", label: "Live Streamed Event", category: "live_stream", occasion: null },
    { id: "obituary", label: "Memorial / Obituary", category: "obituary", occasion: null },
  ],
  corporate: [
    { id: "conference", label: "Conference / Summit", category: "corporate", occasion: "Conference" },
    { id: "offsite", label: "Offsite / Retreat", category: "corporate", occasion: "Team Offsite" },
    { id: "annual_day", label: "Annual Day", category: "corporate", occasion: "Annual Day" },
    { id: "awards", label: "Awards Night", category: "corporate", occasion: "Awards Night" },
    { id: "product_launch", label: "Product Launch", category: "corporate", occasion: "Product Launch" },
    { id: "team_building", label: "Team Building", category: "corporate", occasion: "Team Building Day" },
    { id: "workshop", label: "Workshop / Training", category: "workshop", occasion: null },
    { id: "corporate", label: "Other Corporate Event", category: "corporate", occasion: null },
  ],
};

const PRESET_OCCASIONS: ReadonlySet<string> = new Set(
  SEGMENT_OCCASIONS.corporate.flatMap((o) => (o.occasion ? [o.occasion] : [])),
);

/** Which tile is currently selected — the exact preset if the occasion text still matches one, else the category's plain tile. */
export function findSelectedOccasion(
  category: EventCategory,
  occasion: string | null,
): OccasionOption | undefined {
  const all = [...SEGMENT_OCCASIONS.family, ...SEGMENT_OCCASIONS.corporate];
  return (
    all.find((o) => o.category === category && o.occasion !== null && o.occasion === occasion) ??
    all.find((o) => o.category === category && o.occasion === null)
  );
}

/** Default gallery chapter names for a corporate event, keyed by the stored gallery category (same order as CHAPTERS). */
export const CORPORATE_GALLERY_CHAPTER_TITLES: Record<GalleryCategory, string> = {
  childhood: "Arrivals",
  wedding: "Keynotes & Sessions",
  family: "The Team",
  travel: "Venue & Experiences",
  friends: "Networking",
  grandchildren: "Behind the Scenes",
};

function isCorporateChapterDefaults(titles: Record<string, string> | null | undefined): boolean {
  if (!titles) return false;
  return CHAPTERS.every((c) => titles[c.category] === CORPORATE_GALLERY_CHAPTER_TITLES[c.category]);
}

/**
 * The event fields to save when a host picks an occasion tile. Only
 * touches what the tile owns:
 *
 *   - `occasion`: set to the preset label; cleared when moving away from
 *     a preset, but never clears text the host typed themselves.
 *   - `galleryChapterTitles`: seeded with the corporate defaults when
 *     moving into the corporate segment (only if the host hasn't named
 *     any chapters), and removed again when moving back to family
 *     (only if they're still exactly the untouched defaults).
 */
export function occasionSelectionPatch(
  option: OccasionOption,
  current: { occasion: string | null; galleryChapterTitles: Record<string, string> | null },
): { category: EventCategory; occasion?: string | null; galleryChapterTitles?: Record<string, string> | null } {
  const patch: ReturnType<typeof occasionSelectionPatch> = { category: option.category };

  if (option.occasion) {
    patch.occasion = option.occasion;
  } else if (current.occasion && PRESET_OCCASIONS.has(current.occasion)) {
    patch.occasion = null;
  }

  const titles = galleryTitlesForCategory(option.category, current.galleryChapterTitles);
  if (titles !== undefined) patch.galleryChapterTitles = titles;

  return patch;
}

/**
 * Gallery chapter names to save when an event moves to `category`, or
 * `undefined` when nothing should change: corporate gets the corporate
 * defaults only if the host hasn't named any chapters; family drops them
 * only if they're still exactly the untouched corporate defaults.
 */
export function galleryTitlesForCategory(
  category: EventCategory,
  current: Record<string, string> | null | undefined,
): Record<string, string> | null | undefined {
  const hasCustomTitles = Boolean(current && Object.keys(current).length > 0);
  const segment = getEventSegment(category);
  if (segment === "corporate" && !hasCustomTitles) return { ...CORPORATE_GALLERY_CHAPTER_TITLES };
  if (segment === "family" && isCorporateChapterDefaults(current)) return null;
  return undefined;
}

export interface SectionHeadingCopy {
  eyebrow: string;
  title: string;
  description: string;
}

/** Segment-level wording for the shared pages. Category-level wording (wish message, honoree field) stays in lib/event-category.ts. */
export interface SegmentCopy {
  label: string;
  tagline: string;
  occasionStepTitle: string;
  occasionStepDescription: string;
  draftEventTitle: string;
  timelineStepDescription: string;
  galleryStepDescription: string;
  timeline: SectionHeadingCopy;
  memoryWall: SectionHeadingCopy & { cta: string };
  guest: GuestCopy;
  reels: ReelsCopy;
}

/**
 * Guest Reels wording. Family reels pair each guest with the guest of
 * honour (`h` = honoree name); corporate reels pair attendees with a
 * "featured person" (CEO, keynote speaker…) whose name isn't stored, so
 * corporate copy never names them and refers to the event (`h` = the
 * event/team name) instead.
 */
export interface ReelsCopy {
  pageTitle: string;
  pageIntro: (h: string) => string;
  photoCardTitle: string;
  photoStepTitle: (h: string) => string;
  photoDescription: (h: string) => string;
  consent: (h: string) => string;
  togetherWith: (h: string) => string;
  whatsapp: (first: string, hostedBy: string, h: string, url: string) => string;
  readyDescription: (h: string) => string;
  shareText: (h: string) => string;
  waiting: (hostedBy: string, h: string) => string;
  invite: (h: string) => string;
}

/**
 * Guest-facing wording on the invite page, public upload page and hero.
 * `h` = events.honoree_name, `t` = events.event_title. Family strings are
 * the original hardcoded copy, word for word.
 */
export interface GuestCopy {
  thankYou: string;
  inviteLine: (h: string, t: string) => string;
  endedInviteLine: (h: string, t: string) => string;
  shareText: (h: string, t: string) => string;
  uploadsEyebrow: string;
  uploadsEyebrowAfter: string;
  uploadsTitle: string;
  uploadsDescription: string;
  publicUploadTitle: string;
  publicUploadEyebrow: string;
  publicUploadClosed: string;
  seeOthers: string;
  seeWall: string;
  countdownLabel: string;
  rsvpReminder: string;
}

export const SEGMENT_COPY: Record<EventSegment, SegmentCopy> = {
  family: {
    label: "Family & Personal",
    tagline: "Birthdays, weddings, anniversaries, reunions and more",
    occasionStepTitle: "What are you celebrating?",
    occasionStepDescription: "This shapes the wording and suggestions throughout the rest of the wizard.",
    draftEventTitle: "My Celebration",
    timelineStepDescription: "Optional — add the life milestones shown in your public Timeline section, in order.",
    galleryStepDescription: "Optional — upload the photos shown in your public Gallery section, by category.",
    timeline: {
      eyebrow: "A Journey Through Time",
      title: "Life Timeline",
      description: "A look back at the chapters that shaped this story.",
    },
    memoryWall: {
      eyebrow: "Shared With Love",
      title: "Memory Wall",
      description: "Photos, videos, voice messages, and notes from everyone celebrating with us.",
      cta: "Share Your Memory",
    },
    guest: {
      thankYou: "Thank you for celebrating with us",
      inviteLine: (h, t) => `to celebrate ${h}'s ${t}`,
      endedInviteLine: (h, t) => `Thank you for being part of ${h}'s ${t}. Add the photos and videos you took below.`,
      shareText: (h, t) => `I'm celebrating ${h}'s ${t} 🎉`,
      uploadsEyebrow: "Add To The Celebration",
      uploadsEyebrowAfter: "After The Celebration",
      uploadsTitle: "Share Your Memories",
      uploadsDescription: "Photos, videos, a voice message, or a written note — however you'd like to celebrate.",
      publicUploadTitle: "Share a Memory",
      publicUploadEyebrow: "Share a memory of",
      publicUploadClosed: "upload memories",
      seeOthers: "See memories shared by others",
      seeWall: "See the memories",
      countdownLabel: "Countdown to the celebration",
      rsvpReminder: "Get a reminder to share a photo or video memory before the big day?",
    },
    reels: {
      pageTitle: "Guest Reels",
      pageIntro: (h) =>
        `After the celebration, give every guest a personal Instagram-ready reel of the moments they shared with ${h}. AI recognises each guest (only those who agreed) in the photos from the day and builds their reel automatically.`,
      photoCardTitle: "Guest of honour photo — for personal reels",
      photoStepTitle: (h) => `Photo of ${h}`,
      photoDescription: () =>
        "A clear, front-facing photo of the guest of honour — used to find them in the event photos so every reel features them with the guest.",
      consent: (h) =>
        `${h} has agreed that this photo may be used to recognise them in this event's photos and to create personalised reels for guests.`,
      togetherWith: (h) => `with ${h}`,
      whatsapp: (first, hostedBy, h, url) =>
        `Hi ${first}! ${hostedBy} made you a personal reel from ${h}'s celebration 🎉 Watch it and share it to your Instagram or WhatsApp Status: ${url}`,
      readyDescription: (h) =>
        `The moments you shared with ${h}, set to music. Post it to your Instagram Reels, Story or WhatsApp Status.`,
      shareText: (h) => `Celebrating ${h} 🎉`,
      waiting: (hostedBy, h) =>
        `You're in! Once ${hostedBy} has added the photos from the day, your reel of you with ${h} will appear right here.`,
      invite: (h) =>
        `Want a short video of the photos you're in with ${h}? Add a clear selfie so we can find you in the event photos.`,
    },
  },
  corporate: {
    label: "Corporate & Professional",
    tagline: "Conferences, offsites, annual days, launches and team events",
    occasionStepTitle: "What kind of event is it?",
    occasionStepDescription: "This shapes the wording, templates and suggestions for your attendees.",
    draftEventTitle: "Our Event",
    timelineStepDescription: "Optional — add company or team milestones shown in your public Our Journey section, in order.",
    galleryStepDescription: "Optional — upload photos for your public Gallery, sorted into sections like Keynotes, The Team and Networking.",
    timeline: {
      eyebrow: "How We Got Here",
      title: "Our Journey",
      description: "The milestones behind this moment.",
    },
    memoryWall: {
      eyebrow: "Captured Together",
      title: "Event Wall",
      description: "Photos, videos, voice notes, and messages shared by attendees.",
      cta: "Share a Moment",
    },
    guest: {
      thankYou: "Thank you for joining us",
      inviteLine: (h, t) => `to join ${h} — ${t}`,
      endedInviteLine: (h, t) => `Thank you for being part of ${h} — ${t}. Add the photos and videos you took below.`,
      shareText: (h, t) => `I'm attending ${h} — ${t}`,
      uploadsEyebrow: "Add To The Event",
      uploadsEyebrowAfter: "After The Event",
      uploadsTitle: "Share Your Moments",
      uploadsDescription: "Photos, videos, a voice message, or a written note from the event.",
      publicUploadTitle: "Share a Moment",
      publicUploadEyebrow: "Share a moment from",
      publicUploadClosed: "upload photos and videos",
      seeOthers: "See moments shared by others",
      seeWall: "See the event wall",
      countdownLabel: "Countdown to the event",
      rsvpReminder: "Get a reminder to share your photos and videos from the event?",
    },
    reels: {
      pageTitle: "Attendee Reels",
      pageIntro: (h) =>
        `After ${h}, give every attendee a personal reel of their moments — ready for LinkedIn, Instagram and WhatsApp Status. AI recognises each attendee (only those who agreed) in the event photos and builds their reel automatically.`,
      photoCardTitle: "Featured person photo — for personal reels",
      photoStepTitle: () => "Photo of your featured person",
      photoDescription: () =>
        "A clear, front-facing photo of the person attendees will want to be seen with — your CEO, keynote speaker or award presenter. It's used to find them in the event photos so each reel features them with the attendee.",
      consent: () =>
        "The person in this photo has agreed that it may be used to recognise them in this event's photos and to create personalised reels for attendees.",
      togetherWith: () => "with the featured person",
      whatsapp: (first, hostedBy, h, url) =>
        `Hi ${first}! ${hostedBy} made you a personal reel from ${h} 🎬 Watch it and share it on LinkedIn, Instagram or WhatsApp Status: ${url}`,
      readyDescription: (h) =>
        `Your moments from ${h}, set to music. Share it on LinkedIn, Instagram Reels or WhatsApp Status.`,
      shareText: (h) => `My highlights from ${h}`,
      waiting: (hostedBy, h) =>
        `You're in! Once ${hostedBy} has added the photos from ${h}, your personal reel will appear right here.`,
      invite: (h) =>
        `Want a short video of the photos you're in at ${h}? Add a clear selfie so we can find you in the event photos.`,
    },
  },
};

export function getSegmentCopy(category: EventCategory | null | undefined): SegmentCopy {
  return SEGMENT_COPY[getEventSegment(category)];
}

/** Every category grouped by segment, for plain `<select>` pickers (`<optgroup>` per segment). */
export function categoryOptionsBySegment(
  labels: Record<EventCategory, string>,
): { segment: EventSegment; label: string; options: { value: EventCategory; label: string }[] }[] {
  const all = Object.keys(labels) as EventCategory[];
  return (Object.keys(SEGMENT_COPY) as EventSegment[]).map((segment) => ({
    segment,
    label: SEGMENT_COPY[segment].label,
    options: all.filter((c) => getEventSegment(c) === segment).map((value) => ({ value, label: labels[value] })),
  }));
}

export function parseEventSegment(value: unknown): EventSegment {
  return value === "corporate" ? "corporate" : "family";
}
