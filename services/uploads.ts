import "server-only";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACCEPTED_MIME_TYPES, UPLOAD_LIMITS, type MemoryKind } from "@/types/memory";

const BUCKET_BY_KIND: Record<"photo" | "video" | "audio", string> = {
  photo: "photos",
  video: "videos",
  audio: "audio",
};

const TABLE_BY_KIND: Record<"photo" | "video" | "audio", string> = {
  photo: "photos",
  video: "videos",
  audio: "audio",
};

/** Rough per-guest ceiling so one link can't be used to spam Storage. */
const MAX_UPLOADS_PER_INVITEE = 40;

export class UploadValidationError extends Error {}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .slice(-80);
}

/**
 * Issues a Supabase Storage signed upload URL for a guest's file, after
 * validating the file against the type/size limits from CLAUDE.md and a
 * basic per-invitee upload cap (a lightweight stand-in for real rate
 * limiting — good enough for a family-event site with no external
 * rate-limit service configured).
 */
export async function createSignedMediaUpload(params: {
  inviteeId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { inviteeId, eventId, kind, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES[kind];
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(
      `Unsupported file type for ${kind}: ${contentType}`,
    );
  }

  const limit = UPLOAD_LIMITS[kind];
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(
      `File is too large — ${kind} uploads are limited to ${limit.label}.`,
    );
  }

  const client = supabaseAdmin();
  const table = TABLE_BY_KIND[kind];
  const { count } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("invitee_id", inviteeId);

  if ((count ?? 0) >= MAX_UPLOADS_PER_INVITEE) {
    throw new UploadValidationError(
      "You've reached the upload limit for this invitation link.",
    );
  }

  const bucket = BUCKET_BY_KIND[kind];
  const path = `${eventId}/${inviteeId}/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket, path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Records a completed upload (called after the browser has finished the
 * direct-to-Storage PUT). New rows are always `approved = false` — they
 * enter the Phase 5 admin moderation queue before appearing on the
 * public Memory Wall.
 */
export async function confirmMediaUpload(params: {
  inviteeId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  path: string;
  caption?: string;
}) {
  const { inviteeId, eventId, kind, path, caption } = params;
  const table = TABLE_BY_KIND[kind];

  const { error } = await supabaseAdmin()
    .from(table)
    .insert({
      invitee_id: inviteeId,
      event_id: eventId,
      storage_path: path,
      caption: caption || null,
    });

  if (error) {
    throw new Error(`Failed to save ${kind} upload: ${error.message}`);
  }
}

export function publicMediaUrl(bucket: string, path: string): string {
  const { data } = supabaseAdmin().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export type { MemoryKind };
