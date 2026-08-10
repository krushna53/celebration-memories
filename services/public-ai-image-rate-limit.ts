import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Rate limiting for the public, no-login AI invitation-image tool
 * (#81, app/api/public-ai-image/route.ts) — this endpoint has no admin
 * auth gate and calls a real pay-per-image API, so unlike the admin AI
 * Image feature's per-event quota (events.ai_image_generation_limit),
 * exposure here is bounded by IP + a global cap instead.
 *
 * Per-IP is hourly (client's explicit ask — 1 generation/hour) so
 * nobody can burn through the tool in one sitting; the global cap stays
 * a daily window as a broader safety net across all visitors combined.
 * At ~$0.02-0.05/image (gpt-image-2, medium quality, 1024x1024 — see
 * lib/ai-image.ts), even a maxed-out day costs well under $5.
 */
const PER_IP_HOURLY_LIMIT = 1;
const GLOBAL_DAILY_LIMIT = 40;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
}

/** Checked BEFORE calling OpenAI. Recording the attempt (recordPublicAiImageRequest below) happens separately, after this passes, so a request that fails validation or OpenAI itself doesn't unfairly count against the caller's quota. */
export async function checkPublicAiImageRateLimit(ipHash: string): Promise<RateLimitCheck> {
  const sinceHour = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const sinceDay = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const client = supabaseAdmin();

  const [{ count: ipCount, error: ipError }, { count: globalCount, error: globalError }] = await Promise.all([
    client
      .from("public_ai_image_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", sinceHour),
    client
      .from("public_ai_image_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceDay),
  ]);

  if (ipError || globalError) {
    console.error("checkPublicAiImageRateLimit failed:", ipError?.message, globalError?.message);
    // Fail closed — if we can't verify the limit, don't risk unbounded spend.
    return { allowed: false, reason: "Something went wrong. Please try again in a moment." };
  }

  if ((globalCount ?? 0) >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: "This free tool has hit its daily limit — please try again tomorrow." };
  }
  if ((ipCount ?? 0) >= PER_IP_HOURLY_LIMIT) {
    return { allowed: false, reason: "You can generate 1 free image per hour — please try again in a bit, or build your full event site for unlimited AI images." };
  }

  return { allowed: true };
}

export async function recordPublicAiImageRequest(ipHash: string): Promise<void> {
  const { error } = await supabaseAdmin().from("public_ai_image_requests").insert({ ip_hash: ipHash });
  if (error) console.error("recordPublicAiImageRequest failed:", error.message);
}
