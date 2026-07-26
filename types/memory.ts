export type MemoryKind = "photo" | "video" | "audio" | "guestbook";

export interface MemoryAuthor {
  name: string;
  relationship: string | null;
}

/** Unified shape the public Memory Wall renders, regardless of table. */
export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  message: string | null;
  country: string | null;
  featured: boolean;
  createdAt: string;
  author: MemoryAuthor;
}

export const UPLOAD_LIMITS = {
  photo: { maxBytes: 50 * 1024 * 1024, label: "50MB" },
  video: { maxBytes: 250 * 1024 * 1024, label: "250MB" },
  audio: { maxBytes: 25 * 1024 * 1024, label: "25MB" },
} as const;

export const ACCEPTED_MIME_TYPES = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  video: ["video/mp4", "video/quicktime"],
  audio: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/webm"],
} as const;
