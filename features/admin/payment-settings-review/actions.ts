"use server";

import { revalidatePath } from "next/cache";

import { requireOwner, getAdminByEventId } from "@/services/admin-auth";
import { approveEventPaymentSettings, rejectEventPaymentSettings } from "@/services/event-payment-settings";
import { notifyClientOfEventPaymentSettingsReview } from "@/services/admin-notifications";

export type PaymentSettingsReviewActionResult = { success: true } | { success: false; error: string };

async function notifyClient(eventId: string, approved: boolean, note: string | null) {
  const clientAdmin = await getAdminByEventId(eventId);
  if (!clientAdmin) return; // owner-managed event with no separate client admin — no one to notify
  await notifyClientOfEventPaymentSettingsReview({ adminId: clientAdmin.id, eventId, approved, note });
}

export async function approveEventPaymentSettingsAction(id: string): Promise<PaymentSettingsReviewActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const updated = await approveEventPaymentSettings(id);
    await notifyClient(updated.eventId, true, null);
    revalidatePath("/admin/payment-settings-review");
    revalidatePath("/admin/payment-settings-request");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to approve." };
  }
}

export async function rejectEventPaymentSettingsAction(id: string, note: string): Promise<PaymentSettingsReviewActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const updated = await rejectEventPaymentSettings(id, note);
    await notifyClient(updated.eventId, false, note || null);
    revalidatePath("/admin/payment-settings-review");
    revalidatePath("/admin/payment-settings-request");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reject." };
  }
}
