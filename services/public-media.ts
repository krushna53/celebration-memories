import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import { getEventById } from "@/services/events";
import { getGalleryPhotoById } from "@/services/gallery-photos";
import type { EventRecord } from "@/types/event";

export type PublicMediaKind = "gallery" | "photo" | "video";

export const PUBLIC_MEDIA_KINDS: readonly PublicMediaKind[] = ["gallery", "photo", "video"];

export function isPublicMediaKind(value: string): value is PublicMediaKind {
  return (PUBLIC_MEDIA_KINDS as readonly string[]).includes(value);
}

export interface PublicMediaItem {
  kind: PublicMediaKind;
  id: string;
  url: string;
  caption: string | null;
  authorName: string | null;
  event: EventRecord;
}

const TABLE_BY_KIND: Record<"photo" | "video", string> = {
  photo: "photos",
  video: "videos",
};

interface GuestMediaRow {
  id: string;
  event_id: string;
  caption: string | null;
  storage_path: string;
  approved: boolean;
  invitees: { name: string } | null;
}

/**
 * Resolves one shareable public media item for the `/p/[kind]/[id]`
 * link-preview page (task #80) — either an admin-curated Gallery photo
 * (always public — it's already been through admin curation to get
 * onto the Gallery in the first place) or an approved guest-uploaded
 * photo/video from the Memory Wall. Guest uploads are gated on
 * `approved = true` so an un-moderated upload never gets a public,
 * crawlable/indexable link before an admin has reviewed it. Returns
 * null for anything not found (or not yet approved) so the page can
 * 404 rather than leak the item's existence.
 */
export async function getPublicMediaItem(kind: PublicMediaKind, id: string): Promise<PublicMediaItem | null> {
  if (kind === "gallery") {
    const photo = await getGalleryPhotoById(id);
    if (!photo) return null;
    const event = await getEventById(photo.eventId);
    if (!event) return null;
    return { kind, id, url: photo.url, caption: photo.caption, authorName: null, event };
  }

  const table = TABLE_BY_KIND[kind];
  const { data, error } = await supabaseAdmin()
    .from(table)
    .select("id, event_id, caption, storage_path, approved, invitees(name)")
    .eq("id", id)
    .eq("approved", true)
    .is("deleted_at", null)
    .maybeSingle<GuestMediaRow>();

  if (error || !data) return null;

  const event = await getEventById(data.event_id);
  if (!event) return null;

  return {
    kind,
    id: data.id,
    url: publicMediaUrl(table, data.storage_path),
    caption: data.caption,
    authorName: data.invitees?.name ?? null,
    event,
  };
}
