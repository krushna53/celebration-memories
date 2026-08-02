import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAllActiveEvents } from "@/services/events";

/**
 * Per-event Supabase Storage usage, broken into the three categories the
 * owner cares about for capacity/billing conversations with a client:
 *
 *   - galleryTimelineBytes — admin-curated site content: the Gallery
 *     section and Timeline milestone photos (`gallery` bucket, under
 *     `${eventId}/gallery/` and `${eventId}/timeline/`).
 *   - slideshowBytes — rendered Slideshow Video output (`gallery`
 *     bucket, `${eventId}/slideshow-video/` — see migration 0014's
 *     comment on why the finished MP4 lives in the gallery bucket
 *     rather than its own).
 *   - memoryWallBytes — guest-contributed photos/videos/audio that feed
 *     the public Memory Wall (`photos`/`videos`/`audio` buckets, under
 *     `${eventId}/${inviteeId}/`). Guestbook photos share the `photos`
 *     bucket path with regular guest photo uploads, so they're already
 *     included with no special-casing needed.
 *
 * Deliberately excludes platform/admin-tool assets that aren't part of
 * "how much has this client's event grown" — hero video, AI-generated
 * images, share-image/share-video link-preview assets, slideshow
 * background music, etc. (all also in the `gallery`/`audio` buckets,
 * under their own prefixes — see services/uploads.ts for the full list).
 */
export interface StorageUsageBreakdown {
  galleryTimelineBytes: number;
  slideshowBytes: number;
  memoryWallBytes: number;
  totalBytes: number;
}

export interface EventStorageUsage extends StorageUsageBreakdown {
  eventId: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
}

const MAX_LIST_ENTRIES = 1000;
const MAX_RECURSION_DEPTH = 4;

/**
 * Sums file sizes under a Storage path, recursing into subfolders.
 * Supabase Storage's `list()` returns folders as entries with `id: null`
 * (no size) and files as entries with `id` set + `metadata.size` in
 * bytes — see https://supabase.com/docs/reference/javascript/storage-from-list.
 * `excludeTopLevelNames` only applies at the root of this call (depth 0),
 * for skipping non-guest-upload subfolders that happen to share a
 * bucket with guest uploads (e.g. slideshow background music living
 * alongside guest audio in the `audio` bucket).
 */
async function sumFolderBytes(
  bucket: string,
  path: string,
  excludeTopLevelNames: ReadonlySet<string> = new Set(),
  depth = 0,
): Promise<number> {
  if (depth > MAX_RECURSION_DEPTH) return 0;

  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .list(path, { limit: MAX_LIST_ENTRIES });

  if (error || !data) {
    if (error) console.error(`sumFolderBytes(${bucket}, ${path}) failed:`, error.message);
    return 0;
  }

  let total = 0;
  for (const entry of data) {
    if (depth === 0 && excludeTopLevelNames.has(entry.name)) continue;
    if (entry.id) {
      total += entry.metadata?.size ?? 0;
    } else {
      total += await sumFolderBytes(bucket, `${path}/${entry.name}`, excludeTopLevelNames, depth + 1);
    }
  }
  return total;
}

/**
 * Computes storage usage for one event. Several `list()` calls per
 * event (more if many guests have uploaded, since guest-upload folders
 * are nested one level per invitee) — fine for the current event
 * count/traffic. If this becomes slow as the platform grows, cache the
 * result (e.g. a `storage_usage_snapshots` table refreshed on a cron)
 * rather than computing live on every dashboard load — same tradeoff
 * noted on the media-export route for full-zip generation.
 */
export async function getEventStorageUsage(event: {
  id: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
}): Promise<EventStorageUsage> {
  const [galleryBytes, timelineBytes, slideshowBytes, photosBytes, videosBytes, audioBytes] = await Promise.all([
    sumFolderBytes("gallery", `${event.id}/gallery`),
    sumFolderBytes("gallery", `${event.id}/timeline`),
    sumFolderBytes("gallery", `${event.id}/slideshow-video`),
    sumFolderBytes("photos", event.id),
    sumFolderBytes("videos", event.id),
    sumFolderBytes("audio", event.id, new Set(["slideshow-music"])),
  ]);

  const galleryTimelineBytes = galleryBytes + timelineBytes;
  const memoryWallBytes = photosBytes + videosBytes + audioBytes;

  return {
    eventId: event.id,
    slug: event.slug,
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    galleryTimelineBytes,
    slideshowBytes,
    memoryWallBytes,
    totalBytes: galleryTimelineBytes + slideshowBytes + memoryWallBytes,
  };
}

/**
 * Storage usage for every live event, for the owner-only cross-client
 * comparison dashboard (/admin/storage). Computed live in parallel —
 * see the caching note on getEventStorageUsage if this ever needs to
 * scale beyond a handful of concurrent events.
 */
export async function getAllEventsStorageUsage(): Promise<EventStorageUsage[]> {
  const events = await listAllActiveEvents();
  const usage = await Promise.all(
    events.map((event) =>
      getEventStorageUsage({
        id: event.id,
        slug: event.slug,
        honoreeName: event.honoreeName,
        eventTitle: event.eventTitle,
      }),
    ),
  );
  return usage.sort((a, b) => b.totalBytes - a.totalBytes);
}
