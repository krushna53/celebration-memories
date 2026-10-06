export type GalleryCategory =
  | "childhood"
  | "wedding"
  | "family"
  | "friends"
  | "travel"
  | "grandchildren";

export const GALLERY_CATEGORIES: Array<{
  value: GalleryCategory | "all";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "childhood", label: "Childhood" },
  { value: "wedding", label: "Wedding" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "travel", label: "Travel" },
  // Stored value stays "grandchildren" (existing photos, AI tagger, DB) — only the label changed,
  // so the category fits every kind of event, not just a grandparent's birthday.
  { value: "grandchildren", label: "Little Ones" },
];

/**
 * Gallery photos themselves live in the `gallery_photos` table, managed
 * from /admin/gallery (see services/gallery-photos.ts) — this file now
 * only holds the shared category list/type used by both the admin
 * manager and the public gallery section.
 */

/** A life story reads oldest → newest: chapter order and default titles per category. Hosts can rename any of them per event (events.gallery_chapter_titles). */
export const CHAPTERS: { category: GalleryCategory; title: string }[] = [
  { category: "childhood", title: "The early years" },
  { category: "wedding", title: "The wedding" },
  { category: "family", title: "Family" },
  { category: "travel", title: "Travels" },
  { category: "friends", title: "Friends" },
  { category: "grandchildren", title: "The little ones" },
];

/** Longest custom chapter name — long enough for "Aarav, Myra & Kabir", short enough for a tab. */
export const CHAPTER_TITLE_MAX = 40;

/**
 * Keeps only real categories with a non-empty, trimmed name (an empty
 * name means "back to the default"). Null when nothing custom is left.
 */
export function sanitizeGalleryChapterTitles(input: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!input) return null;
  const valid = new Set<string>(GALLERY_CATEGORIES.map((c) => c.value).filter((v) => v !== "all"));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, CHAPTER_TITLE_MAX) : "";
    if (valid.has(key) && title) out[key] = title;
  }
  return Object.keys(out).length > 0 ? out : null;
}
