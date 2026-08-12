import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Rate limiting for the Custom Form Builder's public, no-login response
 * submission (features/forms/actions.ts's submitCustomFormResponseAction) —
 * mirrors services/public-ai-image-rate-limit.ts's shape (ip_hash +
 * created_at, counted over a rolling window) but scoped per-form rather
 * than global, since each form is an independent surface a bot might
 * target, and a busy legitimate form shouldn't eat into another form's
 * quota.
 *
 * Limits are deliberately looser than the AI Image tool's — this
 * endpoint doesn't call a paid API, so the risk here is junk data and a
 * flooded notify-email inbox, not runaway spend. Fails OPEN (allows the
 * submission) on a DB error, unlike the AI image limiter's fail-closed —
 * blocking a real respondent because a rate-limit query briefly failed
 * is worse than occasionally missing a spam check on a free feature.
 */
const PER_IP_HOURLY_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 500;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
}

/** Checked BEFORE saving a response. Recording the attempt (recordCustomFormSubmissionRequest below) happens separately, after this passes, so a request rejected for a validation error doesn't unfairly count against the caller's quota. */
export async function checkCustomFormSubmissionRateLimit(formId: string, ipHash: string): Promise<RateLimitCheck> {
  const sinceHour = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const sinceDay = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const client = supabaseAdmin();

  const [{ count: ipCount, error: ipError }, { count: globalCount, error: globalError }] = await Promise.all([
    client
      .from("custom_form_submission_requests")
      .select("id", { count: "exact", head: true })
      .eq("form_id", formId)
      .eq("ip_hash", ipHash)
      .gte("created_at", sinceHour),
    client
      .from("custom_form_submission_requests")
      .select("id", { count: "exact", head: true })
      .eq("form_id", formId)
      .gte("created_at", sinceDay),
  ]);

  if (ipError || globalError) {
    console.error("checkCustomFormSubmissionRateLimit failed:", ipError?.message, globalError?.message);
    return { allowed: true };
  }

  if ((globalCount ?? 0) >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: "This form has hit its daily response limit — please try again tomorrow." };
  }
  if ((ipCount ?? 0) >= PER_IP_HOURLY_LIMIT) {
    return { allowed: false, reason: "You've submitted this form several times recently — please try again in a bit." };
  }

  return { allowed: true };
}

export async function recordCustomFormSubmissionRequest(formId: string, ipHash: string): Promise<void> {
  const { error } = await supabaseAdmin().from("custom_form_submission_requests").insert({ form_id: formId, ip_hash: ipHash });
  if (error) console.error("recordCustomFormSubmissionRequest failed:", error.message);
}
