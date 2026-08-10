"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { submitEventPaymentSettings } from "@/services/event-payment-settings";
import { notifyOwnersOfEventPaymentSettingsSubmission } from "@/services/admin-notifications";
import { getEventById } from "@/services/events";
import type { EventPaymentSettingsInput } from "@/types/event-payment-settings";

export type EventPaymentSettingsActionResult = { success: true } | { success: false; error: string };

/**
 * Client (or owner, stepped into an event) submits this event's own
 * payment configuration. Always re-enters "pending_review" — see
 * submitEventPaymentSettings's doc comment — so the owner is notified
 * every time, including on a resubmission after a rejection.
 */
export async function submitEventPaymentSettingsAction(
  eventId: string,
  input: EventPaymentSettingsInput,
  scheduleItemId: string | null = null,
): Promise<EventPaymentSettingsActionResult> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await submitEventPaymentSettings(eventId, input, admin.id, scheduleItemId);

    const event = await getEventById(eventId);
    if (event) {
      await notifyOwnersOfEventPaymentSettingsSubmission({
        eventId,
        eventTitle: event.eventTitle,
        honoreeName: event.honoreeName,
      });
    }

    revalidatePath("/admin/payment-settings-request");
    revalidatePath("/admin/payment-settings-review");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save payment settings." };
  }
}
