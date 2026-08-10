"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { approveRsvpPayment, rejectRsvpPayment, getRsvpPaymentById } from "@/services/rsvp-payments";

export type RsvpPaymentActionResult = { success: true } | { success: false; error: string };

async function requireAdminForPayment(id: string) {
  const payment = await getRsvpPaymentById(id);
  if (!payment) throw new Error("Payment not found.");
  await requireAdminForEvent(payment.eventId);
  return payment;
}

/** Manual (bank/UPI) payments only — gateway-verified payments (Stripe/Razorpay/CCAvenue) are marked paid automatically on return, never through this action. */
export async function approveRsvpPaymentAction(id: string): Promise<RsvpPaymentActionResult> {
  try {
    await requireAdminForPayment(id);
    await approveRsvpPayment(id);
    revalidatePath("/admin/rsvp-payments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to approve." };
  }
}

export async function rejectRsvpPaymentAction(id: string, note: string): Promise<RsvpPaymentActionResult> {
  try {
    await requireAdminForPayment(id);
    await rejectRsvpPayment(id, note);
    revalidatePath("/admin/rsvp-payments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reject." };
  }
}
