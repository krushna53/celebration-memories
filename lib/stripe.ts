import "server-only";
import Stripe from "stripe";

/**
 * Thin wrapper around the Stripe SDK for the wizard's payment step
 * (app/start/[token]/payment, features/start/actions/payment.ts) and its
 * webhook (app/api/webhooks/stripe/route.ts). Returns null when
 * STRIPE_SECRET_KEY isn't set so the payment page degrades to a clear
 * "not configured" message instead of a crash — same pattern as
 * lib/ai-image.ts and lib/shotstack.ts.
 *
 * Setup (all values come from https://dashboard.stripe.com):
 *   STRIPE_SECRET_KEY            — Developers -> API keys -> Secret key
 *   STRIPE_WEBHOOK_SECRET        — Developers -> Webhooks -> your endpoint -> Signing secret
 *   STRIPE_PRICE_ONE_TIME        — Product catalog -> your one-time price ID (price_...)
 *   STRIPE_PRICE_SUBSCRIPTION    — Product catalog -> your recurring price ID (price_...)
 * None of these can be created by an AI assistant — creating a Stripe
 * account and entering real payment/API credentials has to be done by
 * a human. See the README's "Billing" section for the full walkthrough.
 */
function getClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const STRIPE_CONFIGURED = Boolean(process.env.STRIPE_SECRET_KEY);

export const STRIPE_PLANS_CONFIGURED = {
  oneTime: Boolean(process.env.STRIPE_PRICE_ONE_TIME),
  subscription: Boolean(process.env.STRIPE_PRICE_SUBSCRIPTION),
};

export class StripeNotConfiguredError extends Error {}

export function requireStripeClient(): Stripe {
  const client = getClient();
  if (!client) {
    throw new StripeNotConfiguredError(
      "Payments aren't configured yet — add STRIPE_SECRET_KEY to enable checkout.",
    );
  }
  return client;
}
