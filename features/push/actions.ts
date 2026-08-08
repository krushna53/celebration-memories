"use server";

import { getInviteeByToken } from "@/services/invitees";
import { savePushSubscription, removePushSubscription } from "@/services/push";
import type { WebPushSubscriptionInput } from "@/lib/push";

export type PushActionResult = { success: true } | { success: false; error: string };

/**
 * Saves a guest's Web Push subscription against their invitee record.
 * Same "possession of token is the credential" pattern as every other
 * guest-facing action — re-resolves the invitee from the token rather
 * than trusting a client-supplied id.
 */
export async function savePushSubscriptionAction(
  token: string,
  subscription: WebPushSubscriptionInput,
  userAgent?: string,
): Promise<PushActionResult> {
  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    await savePushSubscription({
      inviteeId: found.invitee.id,
      eventId: found.event.id,
      subscription,
      userAgent,
    });
    return { success: true };
  } catch (err) {
    console.error("savePushSubscriptionAction failed:", err);
    return { success: false, error: "Could not enable reminders. Please try again." };
  }
}

export async function removePushSubscriptionAction(token: string, endpoint: string): Promise<PushActionResult> {
  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    await removePushSubscription(found.invitee.id, endpoint);
    return { success: true };
  } catch (err) {
    console.error("removePushSubscriptionAction failed:", err);
    return { success: false, error: "Could not disable reminders. Please try again." };
  }
}
