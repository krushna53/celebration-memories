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
  { value: "grandchildren", label: "Grandchildren" },
];

/**
 * Gallery photos themselves live in the `gallery_photos` table, managed
 * from /admin/gallery (see services/gallery-photos.ts) — this file now
 * only holds the shared category list/type used by both the admin
 * manager and the public gallery section.
 */
