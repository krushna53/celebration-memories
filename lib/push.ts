/**
 * Web Push (VAPID) config helpers — the guest reminder system's client-
 * safe half. Same "config-gated optional integration" shape as
 * lib/ai-image.ts / lib/timezone-lookup.ts: a `*_CONFIGURED` boolean so
 * callers can skip the feature entirely instead of erroring when the
 * env var isn't set. The actual send (which needs VAPID_PRIVATE_KEY,
 * server-only) happens in supabase/functions/send-reminder-push, not
 * here — this file only covers what runs in the browser or in a plain
 * Server Action (requesting permission, subscribing, saving the
 * subscription).
 *
 * No "web-push" npm dependency here on purpose — that package is only
 * used Deno-side (npm:web-push in the Edge Function) where the actual
 * signing happens. The Next.js app never needs to construct a VAPID JWT
 * itself.
 */

export const PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/** True once NEXT_PUBLIC_VAPID_PUBLIC_KEY is set — gates whether any "enable reminders" UI renders at all. */
export const PUSH_CONFIGURED = PUSH_PUBLIC_KEY.length > 0;

/** Shape of PushSubscriptionJSON's keys — what the browser's pushManager.subscribe() returns. */
export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
