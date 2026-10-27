import "server-only";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isVideoMedia } from "@/lib/curated-media";
import { UNHASHABLE, displayPhotoOrder, groupSimilar, similarRepeats } from "@/lib/photo-similarity";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";

/**
 * Perceptual hashes for an event's Gallery and Timeline photos
 * (migration 20261026140000_photo_similarity.sql). Computed here, server-
 * side with sharp, so every photo is hashed the same way whichever device
 * uploaded it. lib/photo-similarity.ts compares them.
 */

/** 64-bit difference hash: shrink to 9×8 greyscale, one bit per "is this pixel brighter than its right neighbour". */
export async function computePhotoHash(image: Buffer): Promise<string> {
  const pixels = await sharp(image).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  const halves = [0, 0];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const bit = pixels[y * 9 + x]! > pixels[y * 9 + x + 1]! ? 1 : 0;
      const half = y < 4 ? 0 : 1;
      halves[half] = ((halves[half]! << 1) | bit) >>> 0;
    }
  }
  return halves.map((h) => h.toString(16).padStart(8, "0")).join("");
}

interface Pending {
  table: "gallery_photos" | "timeline_milestones" | "timeline_milestone_photos";
  id: string;
  path: string;
}

const SOURCES = [
  { table: "gallery_photos", pathColumn: "storage_path", hashColumn: "phash" },
  { table: "timeline_milestones", pathColumn: "image_path", hashColumn: "image_phash" },
  { table: "timeline_milestone_photos", pathColumn: "storage_path", hashColumn: "phash" },
] as const;

function pendingQuery(source: (typeof SOURCES)[number], eventId: string) {
  let query = supabaseAdmin().from(source.table).select(`id, ${source.pathColumn}`, { count: "exact" })
    .eq("event_id", eventId).is(source.hashColumn, null).not(source.pathColumn, "is", null);
  if (source.table === "gallery_photos") query = query.is("deleted_at", null);
  return query;
}

/**
 * Hashes up to `limit` of an event's not-yet-hashed photos (small batches,
 * so each call stays well inside the hosting function time limit). Videos
 * and unreadable files get UNHASHABLE so they're never picked again.
 */
export async function hashPendingPhotos(eventId: string, limit = 12): Promise<{ hashed: number; remaining: number }> {
  const pending: Pending[] = [];
  let total = 0;
  for (const source of SOURCES) {
    const { data, count, error } = await pendingQuery(source, eventId).limit(Math.max(0, limit - pending.length) || 1);
    if (error) throw new Error(`Couldn't read photos: ${error.message}`);
    total += count ?? 0;
    if (pending.length >= limit) continue;
    for (const row of (data ?? []) as unknown as Record<string, string>[]) {
      pending.push({ table: source.table, id: row.id!, path: row[source.pathColumn]! });
    }
  }

  const batch = pending.slice(0, limit);
  let next = 0;
  async function worker() {
    while (next < batch.length) {
      const item = batch[next++]!;
      const source = SOURCES.find((s) => s.table === item.table)!;
      let hash = UNHASHABLE;
      if (!isVideoMedia(item.path)) {
        try {
          const { data, error } = await supabaseAdmin().storage.from("gallery").download(item.path);
          if (!error && data) hash = await computePhotoHash(Buffer.from(await data.arrayBuffer()));
        } catch (err) {
          console.error("hashPendingPhotos: couldn't hash", item.path, err);
        }
      }
      const { error } = await supabaseAdmin().from(item.table).update({ [source.hashColumn]: hash }).eq("id", item.id);
      if (error) throw new Error(`Couldn't save photo hash: ${error.message}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, batch.length) }, worker));
  return { hashed: batch.length, remaining: Math.max(0, total - batch.length) };
}

export interface SimilarPhoto {
  key: string;
  url: string;
  /** Where it lives, e.g. "Gallery" or the milestone's period + title. */
  label: string;
  /** False when the Big Screen skips it as a repeat. */
  shown: boolean;
  /** What "Remove" deletes — null for a milestone's cover (change that on the milestone itself). */
  remove: { kind: "gallery" | "timeline"; id: string } | null;
}

export interface SimilarGroup {
  /** Every photo in the group has exactly the same hash. */
  identical: boolean;
  photos: SimilarPhoto[];
}

/** Groups of look-alike photos among an event's Gallery and Timeline, in Big Screen order. */
export async function listSimilarPhotoGroups(eventId: string): Promise<SimilarGroup[]> {
  const [galleryPhotos, milestones] = await Promise.all([listGalleryPhotos(eventId), listMilestones(eventId)]);
  const info = new Map<string, Omit<SimilarPhoto, "key" | "shown">>();
  for (const photo of galleryPhotos) {
    info.set(`gallery-${photo.id}`, { url: photo.url, label: "Gallery", remove: { kind: "gallery", id: photo.id } });
  }
  for (const m of milestones) {
    const label = [m.period, m.title].filter(Boolean).join(" — ");
    if (m.imageUrl) info.set(`timeline-${m.id}-cover`, { url: m.imageUrl, label: `${label} (cover)`, remove: null });
    for (const photo of m.photos ?? []) {
      info.set(`timeline-${m.id}-${photo.id}`, { url: photo.url, label, remove: { kind: "timeline", id: photo.id } });
    }
  }
  const order = displayPhotoOrder(galleryPhotos, milestones);
  const repeats = similarRepeats(order);
  return groupSimilar(order, (item) => item.hash)
    .filter((group) => group.length > 1)
    .map((group) => ({
      identical: group.every((item) => item.hash === group[0]!.hash),
      photos: group.map((item) => ({ key: item.key, shown: !repeats.has(item.key), ...info.get(item.key)! })),
    }));
}
