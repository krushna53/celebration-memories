import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEventSegment } from "@/lib/event-segment";
import {
  AiTimelineWriterError,
  writeTimelineMilestones,
  type TimelineWriterUsage,
} from "@/lib/ai-timeline-writer";
import type { EventRecord } from "@/types/event";
import type { TimelineMilestoneSuggestion, TimelinePhotoGroupInput } from "@/types/timeline-import";

/** AI calls per event per day for hosts and draft holders (each is a paid call); the platform owner is exempt. */
const PER_EVENT_DAILY_LIMIT = 20;
/** Platform-wide safety cap per day. */
const GLOBAL_DAILY_LIMIT = 300;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** Matches MAX_GROUPS in features/admin/timeline/photo-import.ts. */
export const MAX_TIMELINE_AI_GROUPS = 20;
/** The browser sends ~320px JPEG thumbnails (~25 KB as base64); this leaves room without letting full photos through. */
const MAX_IMAGE_DATA_URL_LENGTH = 150_000;

async function checkLimits(eventId: string, exempt: boolean): Promise<string | null> {
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const client = supabaseAdmin();
  const [perEvent, global] = await Promise.all([
    client.from("timeline_ai_requests").select("id", { count: "exact", head: true }).eq("event_id", eventId).gte("created_at", since),
    client.from("timeline_ai_requests").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  // Fail closed — this calls a paid API.
  if (perEvent.error || global.error) return "Something went wrong. Please try again in a moment.";
  if ((global.count ?? 0) >= GLOBAL_DAILY_LIMIT) return "AI writing is busy today — your milestones are ready to edit by hand.";
  if (!exempt && (perEvent.count ?? 0) >= PER_EVENT_DAILY_LIMIT) {
    return `You've used AI ${PER_EVENT_DAILY_LIMIT} times today for this event — your milestones are ready to edit by hand.`;
  }
  return null;
}

async function record(eventId: string, adminId: string | null, groupCount: number, usage: TimelineWriterUsage, success: boolean) {
  const { error } = await supabaseAdmin().from("timeline_ai_requests").insert({
    event_id: eventId,
    admin_id: adminId,
    group_count: groupCount,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    success,
  });
  if (error) console.error("timeline_ai_requests insert failed:", error.message);
}

function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** The input arrives from the browser — re-shape it field by field rather than trusting it. */
function sanitizeGroups(groups: unknown): TimelinePhotoGroupInput[] {
  if (!Array.isArray(groups) || groups.length === 0) throw new Error("No photo groups to describe.");
  if (groups.length > MAX_TIMELINE_AI_GROUPS) throw new Error(`At most ${MAX_TIMELINE_AI_GROUPS} milestones at a time.`);
  return groups.map((raw) => {
    const g = (raw ?? {}) as Record<string, unknown>;
    const image = g.imageDataUrl;
    if (typeof image !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)) {
      throw new Error("Each photo group needs a JPEG thumbnail.");
    }
    if (image.length > MAX_IMAGE_DATA_URL_LENGTH) throw new Error("A thumbnail was too large.");
    const count = Number(g.photoCount);
    return {
      period: clean(g.period, 40),
      dateLabel: clean(g.dateLabel, 60),
      place: clean(g.place, 120),
      photoCount: Number.isInteger(count) && count > 0 ? Math.min(count, 1000) : 1,
      imageDataUrl: image,
    };
  });
}

/**
 * Rate-limits, calls the writer, records the real token usage, and
 * returns one suggestion per group (not saved). Callers have already
 * authorised the caller for `event`.
 */
export async function suggestTimelineFromPhotos(
  event: EventRecord,
  rawGroups: unknown,
  caller: { adminId: string | null; exempt: boolean },
): Promise<TimelineMilestoneSuggestion[]> {
  const groups = sanitizeGroups(rawGroups);
  const limited = await checkLimits(event.id, caller.exempt);
  if (limited) throw new Error(limited);

  try {
    const { suggestions, usage } = await writeTimelineMilestones(groups, {
      honoreeName: event.honoreeName,
      eventName: event.eventTitle || event.honoreeName,
      category: event.category,
      occasion: event.occasion,
      segment: getEventSegment(event.category),
    });
    await record(event.id, caller.adminId, groups.length, usage, true);
    return suggestions;
  } catch (err) {
    if (err instanceof AiTimelineWriterError && err.usage) await record(event.id, caller.adminId, groups.length, err.usage, false);
    throw err;
  }
}
