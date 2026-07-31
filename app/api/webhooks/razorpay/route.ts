import { NextResponse } from "next/server";
import Razorpay from "razorpay";

import { isRazorpayConfigured } from "@/lib/razorpay";
import { getRazorpaySettings } from "@/services/payment-settings";
import { claimDraftEvent } from "@/services/event-drafts";
import { recordWizardPayment } from "@/services/wizard-payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Razorpay webhook endpoint — configure this URL
 * (https://your-domain/api/webhooks/razorpay) in the Razorpay Dashboard
 * under Settings -> Webhooks, subscribed to `payment_link.paid` (for
 * the one-time plan) and `subscription.charged` /
 * `subscription.activated` (for the recurring plan). Mirrors
 * app/api/webhooks/stripe/route.ts's role exactly: on a successful
 * payment, flips the draft referenced in the payload's notes.eventId to
 * 'active' via claimDraftEvent() and records the payment for
 * /admin/billing. Idempotent for the same reason — claimDraftEvent's
 * UPDATE only matches rows still in 'draft', so a retried/duplicate
 * webhook delivery is a harmless no-op (a duplicate wizard_payments row
 * can happen on retry, but that's a display-only concern, not a
 * billing-correctness one, since Razorpay itself is the source of truth
 * for what was actually charged).
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await isRazorpayConfigured())) {
    return NextResponse.json({ error: "Razorpay isn't configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  const { webhookSecret } = await getRazorpaySettings();
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature or secret." }, { status: 400 });
  }

  const rawBody = await request.text();

  let valid: boolean;
  try {
    valid = Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Razorpay webhook signature check threw:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let payload: {
    event: string;
    payload?: {
      payment_link?: { entity?: { id: string; amount: number; currency: string; notes?: Record<string, string> } };
      subscription?: { entity?: { id: string; notes?: Record<string, string> } };
      payment?: { entity?: { amount: number; currency: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (payload.event === "payment_link.paid") {
      const link = payload.payload?.payment_link?.entity;
      const eventId = link?.notes?.eventId;
      if (eventId) {
        await claimDraftEvent(eventId);
        await recordWizardPayment({
          eventId,
          adminId: null,
          provider: "razorpay",
          plan: "one_time",
          amount: link?.amount ?? 0,
          currency: link?.currency ?? "INR",
          externalId: link?.id ?? null,
        });
      } else {
        console.error("Razorpay payment_link.paid missing notes.eventId", link?.id);
      }
    } else if (payload.event === "subscription.activated" || payload.event === "subscription.charged") {
      const subscription = payload.payload?.subscription?.entity;
      const eventId = subscription?.notes?.eventId;
      if (eventId) {
        await claimDraftEvent(eventId);
        await recordWizardPayment({
          eventId,
          adminId: null,
          provider: "razorpay",
          plan: "subscription",
          amount: payload.payload?.payment?.entity?.amount ?? 0,
          currency: payload.payload?.payment?.entity?.currency ?? "INR",
          externalId: subscription?.id ?? null,
        });
      } else {
        console.error("Razorpay subscription webhook missing notes.eventId", subscription?.id);
      }
    }
  } catch (err) {
    console.error("Razorpay webhook handler failed:", err);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
