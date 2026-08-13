"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent, requireSessionOrganizerForSession } from "@/services/admin-auth";
import { submitEventPaymentSettings } from "@/services/event-payment-settings";
import { notifyOwnersOfEventPaymentSettingsSubmission } from "@/services/admin-notifications";
import { getEventById } from "@/services/events";
import { getScheduleItemById } from "@/services/event-day";
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

/**
 * #106 self-serve counterpart to submitEventPaymentSettingsAction above,
 * for a session_organizer submitting payment settings for their OWN
 * assigned session only — requireSessionOrganizerForSession re-verifies
 * the assignment server-side, and the eventId is resolved from the
 * schedule item itself rather than trusted from the client. Still
 * always re-enters "pending_review" (see submitEventPaymentSettings),
 * so the owner reviews organizer-submitted credentials exactly like
 * client-submitted ones.
 */
export async function submitSessionOrganizerPaymentSettingsAction(
  scheduleItemId: string,
  input: EventPaymentSettingsInput,
): Promise<EventPaymentSettingsActionResult> {
  let admin;
  try {
    admin = await requireSessionOrganizerForSession(scheduleItemId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  const session = await getScheduleItemById(scheduleItemId);
  if (!session) return { success: false, error: "This session couldn't be found." };

  try {
    await submitEventPaymentSettings(session.eventId, input, admin.id, scheduleItemId);

    const event = await getEventById(session.eventId);
    if (event) {
      await notifyOwnersOfEventPaymentSettingsSubmission({
        eventId: session.eventId,
        eventTitle: event.eventTitle,
        honoreeName: event.honoreeName,
      });
    }

    revalidatePath("/admin/payment-settings-request");
    revalidatePath("/admin/payment-settings-review");
    revalidatePath("/admin/my-sessions");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save payment settings." };
  }
}
