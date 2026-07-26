"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { setPaymentSubmissionStatus } from "@/services/payments";

export type PaymentReviewActionResult = { success: true } | { success: false; error: string };

export async function confirmPaymentSubmissionAction(id: string): Promise<PaymentReviewActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await setPaymentSubmissionStatus(id, "confirmed");
    revalidatePath("/admin/payments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function rejectPaymentSubmissionAction(
  id: string,
  note: string,
): Promise<PaymentReviewActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await setPaymentSubmissionStatus(id, "rejected", note || null);
    revalidatePath("/admin/payments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
