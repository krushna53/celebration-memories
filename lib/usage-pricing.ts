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
 *  - Stock music subscription: no provider is actually wired up in the
 *    Video Editor today (Jamendo's free tier turned out non-commercial-
 *    only; a paid catalog — Uppbeat/Envato/Soundstripe/Artlist — was
 *    researched but not yet purchased). STOCK_MUSIC_SUBSCRIPTION_COST_USD_PER_MONTH
 *    below is a manually-set placeholder so the Usage Dashboard has
 *    somewhere to show this cost the moment a subscription starts —
 *    update the constant to whatever plan actually gets purchased.
 *    Defaults to Uppbeat's Pro annual plan ($14.99/mo billed yearly),
 *    the cheapest option researched that explicitly covers client/
 *    commercial content.
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
 * A stock-music subscription (Uppbeat/Envato/etc.) is a flat monthly
 * cost, not a per-render one, so it can't be priced per generation the
 * way Shotstack/OpenAI are above. The Usage Dashboard instead splits
 * this monthly cost across clients proportional to each event's share
 * of total Video Editor renders (see getAllEventsUsage in
 * services/usage-analytics.ts) — an estimate of who's "driving" the
 * subscription cost, not a measurement of which client actually used a
 * stock track on a given render (upload/track selection isn't
 * attributed to a specific event in the database today).
 */
export const STOCK_MUSIC_SUBSCRIPTION_COST_USD_PER_MONTH = 14.99;
