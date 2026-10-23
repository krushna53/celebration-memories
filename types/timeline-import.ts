/**
 * "Build a timeline from photos" (features/admin/timeline/photo-timeline-import.tsx):
 * the browser groups a zip / pile of photos into would-be milestones by
 * when and where they were taken, then sends one small thumbnail per
 * group to the AI for a title + description (lib/ai-timeline-writer.ts).
 */

/** One group of photos, as sent to the AI. Every string here comes from the photo files, never typed by the host. */
export interface TimelinePhotoGroupInput {
  /** Milestone-ready period from the files' dates — "March 1998", "1998", "1998–2001" — or null when undated. */
  period: string | null;
  /** Exact span for context — "14–16 March 1998". */
  dateLabel: string | null;
  /** Reverse-geocoded place — "Lonavala, Maharashtra". */
  place: string | null;
  photoCount: number;
  /** Small JPEG thumbnail of the group's cover photo, as a data: URL. */
  imageDataUrl: string;
}

/** What the AI suggests for one group. Never saved until the host reviews it. */
export interface TimelineMilestoneSuggestion {
  period: string;
  title: string;
  description: string;
}
