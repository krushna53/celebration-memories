import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import type { GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";

interface GalleryPhotoRow {
  id: string;
  event_id: string;
  category: GalleryCategory;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

function mapRow(row: GalleryPhotoRow): GalleryPhotoRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    category: row.category,
    url: publicMediaUrl("gallery", row.storage_path),
    caption: row.caption,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listGalleryPhotos(eventId: string): Promise<GalleryPhotoRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("gallery_photos")
    .select("*")
    .eq("event_id", eventId)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to list gallery photos: ${error.message}`);
  return (data as GalleryPhotoRow[]).map(mapRow);
}

/** One representative photo for an event card (e.g. the /events directory). */
export async function getCoverPhoto(eventId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("gallery_photos")
    .select("storage_path")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load cover photo: ${error.message}`);
  return data ? publicMediaUrl("gallery", data.storage_path) : null;
}

export async function createGalleryPhoto(input: {
  eventId: string;
  category: GalleryCategory;
  storagePath: string;
  caption?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("gallery_photos").insert({
    event_id: input.eventId,
    category: input.category,
    storage_path: input.storagePath,
    caption: input.caption || null,
  });
  if (error) throw new Error(`Failed to add gallery photo: ${error.message}`);
}

export async function updateGalleryPhoto(
  id: string,
  input: { category?: GalleryCategory; caption?: string | null; sortOrder?: number },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.category !== undefined) patch.category = input.category;
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { error } = await supabaseAdmin().from("gallery_photos").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update gallery photo: ${error.message}`);
}

export async function deleteGalleryPhoto(id: string): Promise<void> {
  const client = supabaseAdmin();
  const { data } = await client
    .from("gallery_photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (data?.storage_path) {
    await client.storage.from("gallery").remove([data.storage_path]);
  }

  const { error } = await client.from("gallery_photos").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete gallery photo: ${error.message}`);
}
