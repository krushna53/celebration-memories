/**
 * Canonical registry of the homepage sections a client can reorder and
 * show/hide from /admin/event-settings (see features/admin/event-settings
 * /section-order-manager.tsx). Shared between the admin UI and
 * features/event-landing/event-sections.tsx, which is the only place
 * that actually renders them — this file just defines the vocabulary.
 *
 * "hero" is intentionally excluded: every template needs a first-fold
 * moment, and a homepage with no Hero risks looking broken rather than
 * minimal, so it always renders first and can't be hidden or reordered.
 */
export const SECTION_KEYS = [
  "countdown",
  "invitation",
  "eventDetails",
  "gallery",
  "timeline",
  "rsvp",
  "memoryWall",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface SectionConfigItem {
  key: SectionKey;
  visible: boolean;
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  countdown: "Countdown",
  invitation: "Invitation",
  eventDetails: "Event Details",
  gallery: "Gallery",
  timeline: "Timeline",
  rsvp: "RSVP",
  memoryWall: "Memory Wall",
};

export const DEFAULT_SECTION_CONFIG: SectionConfigItem[] = SECTION_KEYS.map((key) => ({
  key,
  visible: true,
}));

/**
 * Normalizes a possibly-stale or partial config (e.g. saved before a
 * new section key existed, or with an unrecognized key from old data)
 * against the current registry — any missing key is appended as
 * visible, any unrecognized key is dropped. Keeps the admin UI and
 * public render from ever crashing on a config drift.
 */
export function normalizeSectionConfig(
  config: SectionConfigItem[] | null | undefined,
): SectionConfigItem[] {
  if (!config || config.length === 0) return DEFAULT_SECTION_CONFIG;

  const known = config.filter((item): item is SectionConfigItem =>
    (SECTION_KEYS as readonly string[]).includes(item.key),
  );
  const seenKeys = new Set(known.map((item) => item.key));
  const missing = SECTION_KEYS.filter((key) => !seenKeys.has(key)).map((key) => ({
    key,
    visible: true,
  }));

  return [...known, ...missing];
}
