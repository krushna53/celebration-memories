import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WebPushSubscriptionInput } from "@/lib/push";

/**
 * Upserts a guest's push subscription (their browser's pushManager
 * result) against (invitee_id, endpoint) — resubscribing on the same
 * device just refreshes last_used_at rather than creating a duplicate
 * row. A guest can have more than one row if they grant permission on
 * more than one device.
 */
export async function savePushSubscription(params: {
  inviteeId: string;
  eventId: string;
  subscription: WebPushSubscriptionInput;
  userAgent?: string | null;
}): Promise<void> {
  const { inviteeId, eventId, subscription, userAgent } = params;

  const { error } = await supabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        invitee_id: inviteeId,
        event_id: eventId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "invitee_id,endpoint" },
    );

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }
}

/** Removes a subscription — called if the guest revokes notification permission client-side, so a dead endpoint doesn't linger and get sent to (and rejected by) the push service forever. */
export async function removePushSubscription(inviteeId: string, endpoint: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("push_subscriptions")
    .delete()
    .eq("invitee_id", inviteeId)
    .eq("endpoint", endpoint);

  if (error) {
    throw new Error(`Failed to remove push subscription: ${error.message}`);
  }
}
