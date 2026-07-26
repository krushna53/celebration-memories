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
  caption: string | null;
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
