import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  AiRsvpGeneratorError,
  generateRsvpConfig,
  type RsvpGenerationUsage,
} from "@/lib/ai-rsvp-config";
import type { RsvpConfig } from "@/lib/rsvp-config";
import type { EventRecord } from "@/types/event";

/** AI generations per event per day for hosts and draft holders (each is a paid call); the platform owner is exempt. */
const PER_EVENT_DAILY_LIMIT = 10;
/** Platform-wide safety cap per day. */
const GLOBAL_DAILY_LIMIT = 300;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** ~4 MB of image as base64. */
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

async function checkLimits(eventId: string, exempt: boolean): Promise<string | null> {
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const client = supabaseAdmin();
  const [perEvent, global] = await Promise.all([
    client.from("rsvp_ai_generation_requests").select("id", { count: "exact", head: true }).eq("event_id", eventId).gte("created_at", since),
    client.from("rsvp_ai_generation_requests").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  // Fail closed — this calls a paid API.
  if (perEvent.error || global.error) return "Something went wrong. Please try again in a moment.";
  if ((global.count ?? 0) >= GLOBAL_DAILY_LIMIT) return "AI generation is busy today — please try again tomorrow, or set up the form by hand.";
  if (!exempt && (perEvent.count ?? 0) >= PER_EVENT_DAILY_LIMIT) {
    return `You've used AI ${PER_EVENT_DAILY_LIMIT} times today for this event — try again tomorrow, or adjust the form by hand.`;
  }
  return null;
}

async function record(eventId: string, adminId: string | null, mode: "prompt" | "image", usage: RsvpGenerationUsage, success: boolean) {
  const { error } = await supabaseAdmin().from("rsvp_ai_generation_requests").insert({
    event_id: eventId,
    admin_id: adminId,
    mode,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    success,
  });
  if (error) console.error("rsvp_ai_generation_requests insert failed:", error.message);
}

/**
 * Rate-limits, calls the generator, records the real token usage, and
 * returns a config for the builder to show (not saved). Callers have
 * already authorised the caller for `event`.
 */
export async function generateRsvpConfigForEvent(
  event: EventRecord,
  input: { prompt?: string; imageDataUrl?: string },
  caller: { adminId: string | null; exempt: boolean },
): Promise<RsvpConfig> {
  if (input.imageDataUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(input.imageDataUrl)) throw new Error("Upload a PNG, JPG or WebP image.");
    if (input.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) throw new Error("That image is too large — please use one under 4 MB.");
  }
  const limited = await checkLimits(event.id, caller.exempt);
  if (limited) throw new Error(limited);

  const mode = input.imageDataUrl ? "image" : "prompt";
  try {
    const { config, usage } = await generateRsvpConfig(input, {
      category: event.category,
      occasion: event.occasion,
      eventName: event.eventTitle || event.honoreeName,
    });
    await record(event.id, caller.adminId, mode, usage, true);
    return config;
  } catch (err) {
    if (err instanceof AiRsvpGeneratorError && err.usage) await record(event.id, caller.adminId, mode, err.usage, false);
    throw err;
  }
}
