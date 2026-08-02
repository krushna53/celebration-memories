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
  // video/webm is here for in-browser recordings: MediaRecorder can only
  // produce MP4 on Safari — every other browser (Chrome/Android, Edge,
  // Firefox) can only record WebM. Without it, "Record a Video" silently
  // failed to upload on every non-Safari browser. Picked/uploaded files
  // are still expected to be MP4 or MOV (see the file picker's `accept`
  // in features/uploads/components/video-upload.tsx) — WebM only shows
  // up here from a recording, never from the upload picker.
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/webm"],
} as const;
