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
  // Only renders while the event's date poll is open (services/date-poll.ts).
  "datePoll",
  "countdown",
  "invitation",
  "eventDetails",
  "payment",
  "liveStream",
  "gallery",
  "timeline",
  "rsvp",
  "wishMessage",
  "memoryWall",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface SectionConfigItem {
  key: SectionKey;
  visible: boolean;
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  datePoll: "Date Poll",
  countdown: "Countdown",
  invitation: "Invitation",
  eventDetails: "Event Details",
  payment: "Payment Details",
  liveStream: "Live Stream",
  gallery: "Gallery",
  timeline: "Timeline",
  rsvp: "RSVP",
  wishMessage: "Wish Message",
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
  // A key added to the registry after this config was saved goes in at its
  // default spot — right after the nearest key that precedes it in
  // SECTION_KEYS — rather than at the very end (e.g. a new "Payment
  // Details" section lands after Event Details, not after the Memory Wall).
  const result = [...known];
  for (const [index, key] of SECTION_KEYS.entries()) {
    if (result.some((item) => item.key === key)) continue;
    let insertAt = 0;
    for (let i = index - 1; i >= 0; i--) {
      const at = result.findIndex((item) => item.key === SECTION_KEYS[i]);
      if (at !== -1) {
        insertAt = at + 1;
        break;
      }
    }
    result.splice(insertAt, 0, { key, visible: true });
  }

  return result;
}
