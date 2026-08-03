import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAllActiveEvents } from "@/services/events";
import { getAllEventsStorageUsage } from "@/services/storage-usage";
import {
  AI_IMAGE_COST_PER_GENERATION_USD,
  SHOTSTACK_COST_PER_MINUTE_USD,
  SLIDESHOW_ASSUMED_MINUTES,
  VIDEO_EDITOR_ASSUMED_MINUTES,
} from "@/lib/usage-pricing";

/**
 * Cross-client usage + estimated spend, one row per live event, for the
 * owner-only Usage Dashboard (/admin/usage). Pulls real generation
 * counts from the three quota-tracking tables (ai_image_generations,
 * slideshow_video_generations, video_edit_generations — see each
 * feature's actions.ts for where a row gets inserted) and real storage
 * bytes from services/storage-usage.ts, then converts counts into
 * estimated USD using lib/usage-pricing.ts's published-price constants.
 * See that file's header comment for why these dollar figures are
 * estimates, not live billing data.
 */
export interface EventUsage {
  eventId: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
  aiImageCount: number;
  slideshowCount: number;
  videoEditorCount: number;
  storageBytes: number;
  estimatedAiImageCostUsd: number;
  /**
   * Shotstack spend split by which tool triggered the render — Slideshow
   * Video and Video Editor are two separate features that both happen to
   * bill against the same Shotstack account, but an owner trying to spot
   * which client/tool is driving cost needs them broken out, not merged.
   * estimatedShotstackCostUsd (below) is kept as their sum for anything
   * that only wants a single Shotstack total.
   */
  estimatedShotstackSlideshowCostUsd: number;
  estimatedShotstackVideoEditorCostUsd: number;
  estimatedShotstackCostUsd: number;
  estimatedTotalCostUsd: number;
}

/**
 * Counts rows per event_id in a generation-tracking table. These tables
 * are pure quota counters (event_id/admin_id/created_at, sometimes
 * +prompt) with no aggregate/group-by helper in Supabase's JS client
 * for this shape, so — same "compute live, no cache yet" philosophy as
 * getAllEventsStorageUsage — this pulls every row's event_id and groups
 * in JS. Fine at current table sizes; revisit (a SQL view, or a
 * `count(*) ... group by` via `execute_sql`-style RPC) if these tables
 * grow into the tens of thousands of rows.
 */
async function countByEvent(table: "ai_image_generations" | "slideshow_video_generations" | "video_edit_generations"): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin().from(table).select("event_id");
  if (error) {
    console.error(`countByEvent(${table}) failed:`, error.message);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of data as { event_id: string }[]) {
    counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Usage + estimated spend for every live event, sorted by estimated
 * total cost descending — the shape the dashboard wants ("which client
 * has consumed so much") without the owner having to sort it
 * themselves.
 */
export async function getAllEventsUsage(): Promise<EventUsage[]> {
  const [events, storageUsage, aiImageCounts, slideshowCounts, videoEditorCounts] = await Promise.all([
    listAllActiveEvents(),
    getAllEventsStorageUsage(),
    countByEvent("ai_image_generations"),
    countByEvent("slideshow_video_generations"),
    countByEvent("video_edit_generations"),
  ]);

  const storageByEvent = new Map(storageUsage.map((u) => [u.eventId, u.totalBytes]));

  return events
    .map((event) => {
      const aiImageCount = aiImageCounts.get(event.id) ?? 0;
      const slideshowCount = slideshowCounts.get(event.id) ?? 0;
      const videoEditorCount = videoEditorCounts.get(event.id) ?? 0;

      const estimatedAiImageCostUsd = aiImageCount * AI_IMAGE_COST_PER_GENERATION_USD;
      const estimatedShotstackSlideshowCostUsd = slideshowCount * SLIDESHOW_ASSUMED_MINUTES * SHOTSTACK_COST_PER_MINUTE_USD;
      const estimatedShotstackVideoEditorCostUsd = videoEditorCount * VIDEO_EDITOR_ASSUMED_MINUTES * SHOTSTACK_COST_PER_MINUTE_USD;
      const estimatedShotstackCostUsd = estimatedShotstackSlideshowCostUsd + estimatedShotstackVideoEditorCostUsd;

      return {
        eventId: event.id,
        slug: event.slug,
        honoreeName: event.honoreeName,
        eventTitle: event.eventTitle,
        aiImageCount,
        slideshowCount,
        videoEditorCount,
        storageBytes: storageByEvent.get(event.id) ?? 0,
        estimatedAiImageCostUsd,
        estimatedShotstackSlideshowCostUsd,
        estimatedShotstackVideoEditorCostUsd,
        estimatedShotstackCostUsd,
        estimatedTotalCostUsd: estimatedAiImageCostUsd + estimatedShotstackCostUsd,
      };
    })
    .sort((a, b) => b.estimatedTotalCostUsd - a.estimatedTotalCostUsd);
}
