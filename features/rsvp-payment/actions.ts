"use server";

import { getInviteeByToken, getInviteeById } from "@/services/invitees";
import { getEventPaymentSettingsRaw, isEventPaymentConfigured } from "@/services/event-payment-settings";
import {
  createRsvpPayment,
  getLatestRsvpPaymentForInvitee,
  attachRsvpPaymentReferenceNote,
  getRsvpPaymentById,
} from "@/services/rsvp-payments";
import { notifyAdminsOfRsvpPayment } from "@/services/admin-notifications";
import { computeRsvpPrice } from "@/lib/rsvp-pricing";
import {
  createEventStripeCheckoutUrl,
  createEventRazorpayPaymentLink,
  buildEventCCAvenueForm,
  requireProviderCredentials,
} from "@/lib/event-checkout";
import { SITE_URL } from "@/lib/constants";
import type { InviteeWithEvent } from "@/services/invitees";

export type InitiateRsvpPaymentResult =
  | { success: false; error: string }
  | { success: true; alreadyPaid: true }
  | { success: true; alreadyPaid: false; provider: "manual"; paymentId: string; amount: number; currency: string; bankDetails: string | null; upiId: string | null }
  | { success: true; alreadyPaid: false; provider: "stripe" | "razorpay"; redirectUrl: string }
  | { success: true; alreadyPaid: false; provider: "ccavenue"; formPost: { url: string; fields: Record<string, string> } };

async function initiateRsvpPayment(found: InviteeWithEvent, returnPath: string): Promise<InitiateRsvpPaymentResult> {
  const { invitee, event } = found;

  if (!event.isPaidEvent) {
    return { success: false, error: "This event doesn't require payment." };
  }
  if (invitee.rsvpStatus !== "coming") {
    return { success: false, error: "Payment is only needed once you've RSVP'd as coming." };
  }

  const alreadyPaid = await getLatestRsvpPaymentForInvitee(invitee.id);
  if (alreadyPaid?.status === "paid") {
    return { success: true, alreadyPaid: true };
  }

  const price = computeRsvpPrice(event);
  if (!price) {
    return { success: false, error: "Pricing hasn't been set up for this event yet — please check back soon." };
  }

  if (!(await isEventPaymentConfigured(event.id))) {
    return { success: false, error: "Payment isn't set up for this event yet — please contact the host." };
  }

  const settings = await getEventPaymentSettingsRaw(event.id);
  if (!settings) {
    return { success: false, error: "Payment isn't set up for this event yet — please contact the host." };
  }

  const payment = await createRsvpPayment({
    eventId: event.id,
    inviteeId: invitee.id,
    amount: price.amount,
    currency: price.currency,
    pricingTier: price.tier,
    provider: settings.provider,
  });

  const description = `${event.honoreeName}'s ${event.eventTitle} — RSVP registration`;
  const cancelUrl = `${SITE_URL}${returnPath}`;

  try {
    if (settings.provider === "manual") {
      return {
        success: true,
        alreadyPaid: false,
        provider: "manual",
        paymentId: payment.id,
        amount: price.amount,
        currency: price.currency,
        bankDetails: settings.bankDetails,
        upiId: settings.upiId,
      };
    }

    if (settings.provider === "stripe") {
      const { stripeSecretKey } = requireProviderCredentials(settings) as { stripeSecretKey: string };
      const successUrl = `${SITE_URL}/rsvp-payment/confirm?paymentId=${payment.id}&provider=stripe&session_id={CHECKOUT_SESSION_ID}&return=${encodeURIComponent(returnPath)}`;
      const redirectUrl = await createEventStripeCheckoutUrl({
        secretKey: stripeSecretKey,
        amount: price.amount,
        currency: price.currency,
        description,
        successUrl,
        cancelUrl,
        customerEmail: invitee.email ?? undefined,
        metadata: { rsvpPaymentId: payment.id, eventId: event.id, inviteeId: invitee.id },
      });
      return { success: true, alreadyPaid: false, provider: "stripe", redirectUrl };
    }

    if (settings.provider === "razorpay") {
      const { razorpayKeyId, razorpayKeySecret } = requireProviderCredentials(settings) as {
        razorpayKeyId: string;
        razorpayKeySecret: string;
      };
      const callbackUrl = `${SITE_URL}/rsvp-payment/confirm?paymentId=${payment.id}&provider=razorpay&return=${encodeURIComponent(returnPath)}`;
      const redirectUrl = await createEventRazorpayPaymentLink({
        keyId: razorpayKeyId,
        keySecret: razorpayKeySecret,
        amount: price.amount,
        currency: price.currency,
        description,
        customerName: invitee.name,
        customerEmail: invitee.email ?? undefined,
        callbackUrl,
        notes: { rsvpPaymentId: payment.id, eventId: event.id, inviteeId: invitee.id },
      });
      return { success: true, alreadyPaid: false, provider: "razorpay", redirectUrl };
    }

    // ccavenue
    const { ccavenueMerchantId, ccavenueAccessCode, ccavenueWorkingKey } = requireProviderCredentials(settings) as {
      ccavenueMerchantId: string;
      ccavenueAccessCode: string;
      ccavenueWorkingKey: string;
    };
    const responseUrl = `${SITE_URL}/api/webhooks/rsvp-ccavenue?paymentId=${payment.id}&return=${encodeURIComponent(returnPath)}`;
    const formPost = buildEventCCAvenueForm({
      merchantId: ccavenueMerchantId,
      accessCode: ccavenueAccessCode,
      workingKey: ccavenueWorkingKey,
      amount: price.amount,
      currency: price.currency,
      orderId: `${payment.id.slice(0, 8)}-${Date.now()}`,
      responseUrl,
      cancelUrl,
      billingName: invitee.name,
      billingEmail: invitee.email ?? undefined,
      merchantParam1: payment.id,
    });
    return { success: true, alreadyPaid: false, provider: "ccavenue", formPost };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start payment. Please try again." };
  }
}

/** Token flow — /invite/[token]. */
export async function initiateRsvpPaymentByTokenAction(token: string): Promise<InitiateRsvpPaymentResult> {
  const found = await getInviteeByToken(token);
  if (!found) return { success: false, error: "This invitation link is not valid." };
  return initiateRsvpPayment(found, `/invite/${token}`);
}

/** Public, no-token flow — /events/[slug]/rsvp. inviteeId only ever comes from submitPublicRsvpAction's own return value, never raw client input. */
export async function initiateRsvpPaymentPublicAction(eventSlug: string, inviteeId: string): Promise<InitiateRsvpPaymentResult> {
  const found = await getInviteeById(inviteeId);
  if (!found || found.event.slug !== eventSlug) {
    return { success: false, error: "We couldn't find your RSVP — please submit it again." };
  }
  return initiateRsvpPayment(found, `/events/${eventSlug}/rsvp`);
}

export type SubmitManualRsvpProofResult = { success: true } | { success: false; error: string };

/** Guest attaches a bank/UPI reference note to their pending manual payment — an admin still has to approve it (features/admin/rsvp-payments/actions.ts). */
export async function submitManualRsvpPaymentProofAction(
  paymentId: string,
  referenceNote: string,
): Promise<SubmitManualRsvpProofResult> {
  if (!referenceNote.trim()) {
    return { success: false, error: "Please enter a reference number or note." };
  }

  try {
    await attachRsvpPaymentReferenceNote(paymentId, referenceNote.trim());
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to submit. Please try again." };
  }

  // Best-effort — the reference note is already saved either way.
  notifyPaymentSubmitted(paymentId).catch((err) => console.error("notifyAdminsOfRsvpPayment failed:", err));

  return { success: true };
}

async function notifyPaymentSubmitted(paymentId: string) {
  const payment = await getRsvpPaymentById(paymentId);
  if (!payment) return;
  const found = await getInviteeById(payment.inviteeId);
  if (!found) return;
  await notifyAdminsOfRsvpPayment({
    eventId: payment.eventId,
    guestName: found.invitee.name,
    amount: payment.amount,
    currency: payment.currency,
    needsReview: true,
  });
}
