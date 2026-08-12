import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Rate limiting for the Custom Form Builder's AI form generation
 * (features/forms/builder-actions.ts's generateFormFromPromptAction /
 * generateFormFromImageAction, backed by lib/ai-form-generator.ts) —
 * same shape as services/public-ai-image-rate-limit.ts (hashed IP +
 * rolling window), and fails CLOSED on a DB error like that limiter,
 * unlike services/custom-form-rate-limit.ts's fail-open — this
 * endpoint calls a real paid OpenAI API, so the cost-risk reasoning is
 * the same as the AI Image tool's, not the free response-submission
 * endpoint's.
 *
 * Reachable by anyone holding a form's draft_token (no separate login),
 * same exposure model as the builder itself — the token requirement
 * alone isn't a strong cost control (tokens are cheap to obtain, just
 * visit /forms/new), so this per-IP + global cap is the real guard.
 */
const PER_IP_HOURLY_LIMIT = 5;
const GLOBAL_DAILY_LIMIT = 100;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
}

export async function checkCustomFormAiGenerationRateLimit(ipHash: string): Promise<RateLimitCheck> {
  const sinceHour = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const sinceDay = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const client = supabaseAdmin();

  const [{ count: ipCount, error: ipError }, { count: globalCount, error: globalError }] = await Promise.all([
    client
      .from("custom_form_ai_generation_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", sinceHour),
    client
      .from("custom_form_ai_generation_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceDay),
  ]);

  if (ipError || globalError) {
    console.error("checkCustomFormAiGenerationRateLimit failed:", ipError?.message, globalError?.message);
    // Fail closed — same reasoning as the AI Image tool: don't risk unbounded spend if the check itself can't be verified.
    return { allowed: false, reason: "Something went wrong. Please try again in a moment." };
  }

  if ((globalCount ?? 0) >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: "AI form generation has hit its daily limit — please try again tomorrow, or build the form by hand." };
  }
  if ((ipCount ?? 0) >= PER_IP_HOURLY_LIMIT) {
    return { allowed: false, reason: "You've used AI generation several times recently — please try again in a bit." };
  }

  return { allowed: true };
}

export async function recordCustomFormAiGenerationRequest(ipHash: string): Promise<void> {
  const { error } = await supabaseAdmin().from("custom_form_ai_generation_requests").insert({ ip_hash: ipHash });
  if (error) console.error("recordCustomFormAiGenerationRequest failed:", error.message);
}
