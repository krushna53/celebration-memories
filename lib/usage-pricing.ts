/**
 * Published, list-price constants used to *estimate* per-client spend on
 * the Usage Dashboard (/admin/usage) — see services/usage-analytics.ts.
 *
 * IMPORTANT — these are estimates, not live billing data. Neither
 * Shotstack nor OpenAI's API returns a per-render/per-image cost in its
 * response payload, and none of the generation-tracking tables
 * (`ai_image_generations`, `slideshow_video_generations`,
 * `video_edit_generations`) store render duration, output size, or
 * token counts — only `event_id`/`admin_id`/`created_at`. So every
 * dollar figure on the dashboard is (generation count) × (a published
 * list price below), not a number pulled from either provider's actual
 * invoice. If Shotstack's or OpenAI's billing/usage APIs ever get wired
 * up for real per-render cost, replace this file's math with that.
 *
 * Sources (checked August 2026):
 *  - Shotstack pay-as-you-go: $0.40 per rendered minute (25-credit
 *    minimum purchase at $10, credits valid 1 year). A subscription
 *    plan brings this down to $0.20/min (from $39/mo) — this file
 *    deliberately uses the higher pay-as-you-go rate so the estimate
 *    skews conservative (over-, not under-, counts spend) regardless of
 *    which Shotstack plan is actually active. https://shotstack.io
 *  - OpenAI gpt-image-2, quality "high", 1024x1024: commonly-quoted
 *    derived cost is ~$0.165/image, from the model's token-based
 *    pricing ($8/1M image input tokens, $30/1M image output tokens) —
 *    not an official flat per-image price, since actual cost also
 *    depends on prompt length.
 */

/** Estimated USD cost per AI Image generation (services/video-editor.ts's sibling, ai-image, at quality "high"). */
export const AI_IMAGE_COST_PER_GENERATION_USD = 0.165;

/** Shotstack pay-as-you-go rate, USD per rendered minute. */
export const SHOTSTACK_COST_PER_MINUTE_USD = 0.4;

/**
 * Neither render pipeline (Slideshow Video, Video Editor) stores actual
 * output duration today, so spend is estimated from an assumed average
 * render length per generation rather than a real number. Video Editor
 * edits are user-built and often stitch together several clips;
 * Slideshow Video auto-cycles through fewer photos with short
 * transitions — hence the different assumptions. Adjust these two
 * constants directly once you have a feel for real-world render
 * lengths on this platform.
 */
export const SLIDESHOW_ASSUMED_MINUTES = 1;
export const VIDEO_EDITOR_ASSUMED_MINUTES = 1.5;

/**
 * Text-model pricing for the Custom Form Builder's AI form generation
 * (lib/ai-form-generator.ts, /forms/new + the builder's "Build with
 * AI" panel) — see /admin/usage's "Build a Form — AI Generation"
 * section, services/form-ai-usage.ts.
 *
 * Unlike AI_IMAGE_COST_PER_GENERATION_USD above (a flat per-call
 * estimate, since neither Shotstack nor the image endpoint returns a
 * real per-call cost), this one IS computed from real numbers: OpenAI's
 * Responses API returns actual input/output token counts per call
 * (response.usage), captured and stored per-request in
 * custom_form_ai_generation_requests. Only the *price per token* below
 * is a published-rate estimate, not a live billing pull — same
 * "estimate, not invoice" caveat as the rest of this file.
 *
 * Rates as USD per 1,000,000 tokens, checked August 2026
 * (https://devtk.ai/en/blog/openai-api-pricing-guide-2026/, updated
 * 2026-08-01 for OpenAI's August price cuts — verify against your own
 * OpenAI billing dashboard, since third-party rate cards can lag or
 * miss volume/regional adjustments). `gpt-5.6` is documented as an
 * alias for `gpt-5.6-sol`. Any model name not listed here falls back
 * to the Luna rate (this feature's actual default, per
 * `OPENAI_TEXT_MODEL || "gpt-5.6-luna"` in lib/ai-form-generator.ts)
 * rather than silently reporting $0.
 */
export const TEXT_MODEL_PRICING_USD_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2.0, output: 12.0 },
  "gpt-5.6-sol": { input: 5.0, output: 30.0 },
  "gpt-5.6": { input: 5.0, output: 30.0 },
};

const FALLBACK_TEXT_MODEL_RATE = TEXT_MODEL_PRICING_USD_PER_1M_TOKENS["gpt-5.6-luna"]!;

/** USD cost for one AI form-generation call, from its real input/output token counts. */
export function computeFormAiGenerationCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = TEXT_MODEL_PRICING_USD_PER_1M_TOKENS[model] ?? FALLBACK_TEXT_MODEL_RATE;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}
