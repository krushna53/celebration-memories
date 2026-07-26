export type GalleryCategory =
  | "childhood"
  | "wedding"
  | "family"
  | "friends"
  | "travel"
  | "grandchildren";

export interface GalleryItem {
  id: string;
  category: GalleryCategory;
  /** Path under /public, e.g. "/gallery/family/001.jpg" */
  src: string;
  alt: string;
  caption?: string;
}

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
 * Gallery photos are intentionally empty until real family photos are
 * supplied. The component renders a graceful "coming soon" empty state
 * per category rather than shipping placeholder stock imagery.
 *
 * To add photos:
 *   1. Drop optimised JPEG/WEBP files under /public/gallery/<category>/
 *   2. Add one entry per photo below, e.g.:
 *      { id: "fam-01", category: "family", src: "/gallery/family/001.jpg",
 *        alt: "Family gathering, Diwali 2019", caption: "Diwali, 2019" }
 */
export const GALLERY_ITEMS: GalleryItem[] = [];
