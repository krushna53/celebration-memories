import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import { getGalleryPhotoById, listGalleryPhotos } from "@/services/gallery-photos";
import type { GalleryPairRecord, GuestGalleryPhoto } from "@/types/content";

/**
 * Data behind the gallery's storytelling extras — "Then & Now" pairs
 * (gallery_pairs, migration 0062) and the "From guests" tab (approved
 * guest photos from the memory wall). Kept out of gallery-photos.ts /
 * memory-wall.ts so those stay focused on their own tables.
 */

interface PairRow {
  id: string;
  then_photo_id: string;
  now_photo_id: string;
  caption: string | null;
}

/** Pairs whose photos both still exist (a trashed photo hides its pair rather than breaking it). */
export async function listGalleryPairs(eventId: string): Promise<GalleryPairRecord[]> {
  const [{ data, error }, photos] = await Promise.all([
    supabaseAdmin()
      .from("gallery_pairs")
      .select("id, then_photo_id, now_photo_id, caption")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    listGalleryPhotos(eventId),
  ]);
  if (error) {
    console.error("listGalleryPairs failed:", error.message);
    return [];
  }
  const byId = new Map(photos.map((p) => [p.id, p]));
  return ((data ?? []) as PairRow[]).flatMap((row) => {
    const thenPhoto = byId.get(row.then_photo_id);
    const nowPhoto = byId.get(row.now_photo_id);
    return thenPhoto && nowPhoto ? [{ id: row.id, thenPhoto, nowPhoto, caption: row.caption }] : [];
  });
}

/** Both photos must belong to `eventId` — re-checked here so a tampered id can't pair another event's photo. */
export async function createGalleryPair(input: {
  eventId: string;
  thenPhotoId: string;
  nowPhotoId: string;
  caption: string | null;
}): Promise<void> {
  if (input.thenPhotoId === input.nowPhotoId) throw new Error("Pick two different photos.");
  const [thenPhoto, nowPhoto] = await Promise.all([
    getGalleryPhotoById(input.thenPhotoId),
    getGalleryPhotoById(input.nowPhotoId),
  ]);
  if (!thenPhoto || !nowPhoto || thenPhoto.eventId !== input.eventId || nowPhoto.eventId !== input.eventId) {
    throw new Error("Photo not found.");
  }
  const { count } = await supabaseAdmin()
    .from("gallery_pairs")
    .select("id", { count: "exact", head: true })
    .eq("event_id", input.eventId);
  const { error } = await supabaseAdmin().from("gallery_pairs").insert({
    event_id: input.eventId,
    then_photo_id: input.thenPhotoId,
    now_photo_id: input.nowPhotoId,
    caption: input.caption?.trim() || null,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(`Failed to create pair: ${error.message}`);
}

export async function deleteGalleryPair(eventId: string, pairId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("gallery_pairs").delete().eq("id", pairId).eq("event_id", eventId);
  if (error) throw new Error(`Failed to delete pair: ${error.message}`);
}

/** Approved guest photos for the "From guests" gallery tab — same approval rules as the memory wall. */
export async function listGuestGalleryPhotos(eventId: string, limit = 60): Promise<GuestGalleryPhoto[]> {
  const { data, error } = await supabaseAdmin()
    .from("photos")
    .select("id, caption, storage_path, invitees(name)")
    .eq("event_id", eventId)
    .eq("approved", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listGuestGalleryPhotos failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const invitee = (row as { invitees?: { name?: string | null } | null }).invitees;
    return {
      id: row.id as string,
      url: publicMediaUrl("photos", row.storage_path as string),
      caption: (row.caption as string | null) ?? null,
      authorName: invitee?.name?.trim() || "A guest",
    };
  });
}
