"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { approveRsvpPayment, rejectRsvpPayment, getRsvpPaymentById } from "@/services/rsvp-payments";
import { createSessionRegistration } from "@/services/session-registrations";

export type RsvpPaymentActionResult = { success: true } | { success: false; error: string };

/** Session organizers can only VIEW their own session's attendees/payments (see /admin/my-sessions) — approve/reject stays owner + client only. */
async function requireAdminForPayment(id: string) {
  const payment = await getRsvpPaymentById(id);
  if (!payment) throw new Error("Payment not found.");
  const admin = await requireAdminForEvent(payment.eventId);
  if (admin.role === "session_organizer") {
    throw new Error("Session organizers can view payments but can't approve or reject them.");
  }
  return payment;
}

/** Manual (bank/UPI) payments only — gateway-verified payments (Stripe/Razorpay/CCAvenue) are marked paid automatically on return, never through this action. */
export async function approveRsvpPaymentAction(id: string): Promise<RsvpPaymentActionResult> {
  try {
    const payment = await requireAdminForPayment(id);
    await approveRsvpPayment(id);
    if (payment.scheduleItemId) {
      await createSessionRegistration({
        eventId: payment.eventId,
        scheduleItemId: payment.scheduleItemId,
        inviteeId: payment.inviteeId,
        rsvpPaymentId: payment.id,
      });
    }
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
