import { NextResponse } from "next/server";

import { requireStripeClient, STRIPE_CONFIGURED } from "@/lib/stripe";
import { claimDraftEvent } from "@/services/event-drafts";

export const dynamic = "force-dynamic";
// Stripe's SDK needs Node's crypto module for signature verification —
// not available on the Edge runtime.
export const runtime = "nodejs";

/**
 * Stripe webhook endpoint — configure this URL
 * (https://your-domain/api/webhooks/stripe) in the Stripe Dashboard
 * under Developers -> Webhooks, subscribed to at least
 * `checkout.session.completed`. On that event, flips the draft event
 * referenced in the session's metadata.eventId to 'active' via
 * claimDraftEvent() — the one and only place that happens (see
 * services/event-drafts.ts's doc comment on claimDraftEvent). The
 * `admins` row scoping the host to this event was already created
 * earlier, when they verified their email (handle_new_confirmed_admin
 * trigger) — this webhook only unlocks the event itself.
 *
 * Deliberately idempotent: claimDraftEvent's underlying UPDATE has
 * `where status = 'draft'`, so a duplicate/retried webhook delivery for
 * an already-claimed event is a harmless no-op.
 */
export async function POST(request: Request): Promise<Response> {
  if (!STRIPE_CONFIGURED) {
    return NextResponse.json({ error: "Stripe isn't configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature or secret." }, { status: 400 });
  }

  const rawBody = await request.text();

  const stripe = requireStripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const eventId = session.metadata?.eventId;
      if (eventId) {
        await claimDraftEvent(eventId);
      } else {
        console.error("Stripe checkout.session.completed missing metadata.eventId", session.id);
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler failed:", err);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
