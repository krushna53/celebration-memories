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

export interface TimelineMilestoneRecord {
  id: string;
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder: number;
  createdAt: string;
}
