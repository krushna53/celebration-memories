"use server";

import { redirect } from "next/navigation";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { getAdminByEventId } from "@/services/admin-auth";
import { requireStripeClient, STRIPE_CONFIGURED, STRIPE_PLANS_CONFIGURED, StripeNotConfiguredError } from "@/lib/stripe";
import { SITE_URL } from "@/lib/constants";
import { wizardStepHref } from "@/features/start/wizard-steps";

export type BillingPlan = "one_time" | "subscription";

export interface CheckoutPrereqs {
  stripeConfigured: boolean;
  oneTimeConfigured: boolean;
  subscriptionConfigured: boolean;
  /** Null until the host verifies their email — see handle_new_confirmed_admin trigger. */
  accountEmail: string | null;
}

/** What the payment page needs to know before rendering its two plan buttons. */
export async function getCheckoutPrereqs(token: string, eventId: string): Promise<CheckoutPrereqs> {
  const event = await requireDraftEvent(token);
  if (event.id !== eventId) throw new Error("This link doesn't match that event.");

  const admin = await getAdminByEventId(event.id);
  return {
    stripeConfigured: STRIPE_CONFIGURED,
    oneTimeConfigured: STRIPE_PLANS_CONFIGURED.oneTime,
    subscriptionConfigured: STRIPE_PLANS_CONFIGURED.subscription,
    accountEmail: admin?.email ?? null,
  };
}

export type CreateCheckoutResult = { success: false; error: string };

/**
 * Creates a Stripe Checkout Session and redirects the browser straight
 * to Stripe's hosted checkout page — no card data ever touches this
 * app's own code. On success, Stripe redirects to
 * /start/success?slug=... (deliberately outside the /start/[token]/...
 * layout, since the webhook may have already flipped this draft to
 * 'active' by the time the browser gets there, which would otherwise
 * trip the "link no longer active" screen). See
 * app/api/webhooks/stripe/route.ts for what actually claims the draft.
 */
export async function createCheckoutSessionAction(
  token: string,
  eventId: string,
  plan: BillingPlan,
): Promise<CreateCheckoutResult> {
  let event;
  try {
    event = await requireDraftEvent(token);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "This link is no longer valid." };
  }
  if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };

  const admin = await getAdminByEventId(event.id);
  if (!admin) {
    return {
      success: false,
      error: "Please verify your email first — check your inbox for the confirmation link, then come back here.",
    };
  }

  let stripe;
  try {
    stripe = requireStripeClient();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return { success: false, error: err.message };
    throw err;
  }

  const priceId = plan === "one_time" ? process.env.STRIPE_PRICE_ONE_TIME : process.env.STRIPE_PRICE_SUBSCRIPTION;
  if (!priceId) {
    return { success: false, error: `The ${plan === "one_time" ? "one-time" : "subscription"} plan isn't configured yet.` };
  }

  const paymentPath = wizardStepHref(token, "payment");

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: plan === "one_time" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: admin.email,
      success_url: `${SITE_URL}/start/success?slug=${encodeURIComponent(event.slug)}`,
      cancel_url: `${SITE_URL}${paymentPath}`,
      metadata: { eventId: event.id, draftToken: token },
      subscription_data: plan === "subscription" ? { metadata: { eventId: event.id } } : undefined,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start checkout." };
  }

  if (!session.url) return { success: false, error: "Stripe didn't return a checkout URL. Please try again." };
  redirect(session.url);
}
