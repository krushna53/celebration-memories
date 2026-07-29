/**
 * Unified slide shape for the "Big Screen Display" — a chrome-free,
 * full-viewport slideshow meant to be opened on a TV/projector at the
 * venue (see app/events/[slug]/display and lib/build-display-slides.ts).
 * Deliberately its own type rather than reusing types/content.ts's
 * SlideSource (Slideshow Video composer) — that one is photo-only and
 * feeds a server-side Shotstack render; this one plays live in the
 * browser and needs to represent video/audio/text memories too.
 */
export type DisplaySlideKind =
  | "title"
  | "highlight-reel"
  | "gallery-photo"
  | "timeline"
  | "memory-photo"
  | "memory-video"
  | "memory-audio"
  | "memory-note";

interface BaseSlide {
  id: string;
}

export interface TitleSlide extends BaseSlide {
  kind: "title";
  honoreeName: string;
  eventTitle: string;
  hostedBy: string;
  occasionDate: string | null;
}

export interface HighlightReelSlide extends BaseSlide {
  kind: "highlight-reel";
  url: string;
}

export interface GalleryPhotoSlide extends BaseSlide {
  kind: "gallery-photo";
  url: string;
  caption: string | null;
}

export interface TimelineSlide extends BaseSlide {
  kind: "timeline";
  imageUrl: string | null;
  period: string;
  title: string;
  description: string;
}

export interface MemoryPhotoSlide extends BaseSlide {
  kind: "memory-photo";
  url: string;
  authorName: string;
  caption: string | null;
}

export interface MemoryVideoSlide extends BaseSlide {
  kind: "memory-video";
  url: string;
  authorName: string;
  /** Caption the relative left with their upload, if any — shown under their name so the video plays with context instead of just a name. */
  caption: string | null;
}

export interface MemoryAudioSlide extends BaseSlide {
  kind: "memory-audio";
  url: string;
  authorName: string;
  caption: string | null;
}

export interface MemoryNoteSlide extends BaseSlide {
  kind: "memory-note";
  message: string;
  authorName: string;
  country: string | null;
  thumbnailUrl: string | null;
}

export type DisplaySlide =
  | TitleSlide
  | HighlightReelSlide
  | GalleryPhotoSlide
  | TimelineSlide
  | MemoryPhotoSlide
  | MemoryVideoSlide
  | MemoryAudioSlide
  | MemoryNoteSlide;
