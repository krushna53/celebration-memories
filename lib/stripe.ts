import "server-only";
import Stripe from "stripe";

import { getStripeSettings } from "@/services/payment-settings";

/**
 * Thin wrapper around the Stripe SDK for the wizard's payment step
 * (app/start/[token]/payment, features/start/actions/payment.ts) and its
 * webhook (app/api/webhooks/stripe/route.ts).
 *
 * Credentials come from services/payment-settings.ts, which checks the
 * owner-editable `payment_provider_settings` DB row first (see
 * /admin/billing's "API Keys" section) and falls back to environment
 * variables if nothing's set there:
 *   STRIPE_SECRET_KEY            — Developers -> API keys -> Secret key
 *   STRIPE_WEBHOOK_SECRET        — Developers -> Webhooks -> your endpoint -> Signing secret
 *   STRIPE_PRICE_ONE_TIME        — Product catalog -> your one-time price ID (price_...)
 *   STRIPE_PRICE_SUBSCRIPTION    — Product catalog -> your recurring price ID (price_...)
 * Creating the Stripe account itself still has to be done by a human —
 * this just removes the "then redeploy to change a key" step
 * afterward.
 */
async function getClient(): Promise<Stripe | null> {
  const { secretKey } = await getStripeSettings();
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export async function isStripeConfigured(): Promise<boolean> {
  const { secretKey } = await getStripeSettings();
  return Boolean(secretKey);
}

export async function getStripePlansConfigured(): Promise<{ oneTime: boolean; subscription: boolean }> {
  const { priceOneTime, priceSubscription } = await getStripeSettings();
  return { oneTime: Boolean(priceOneTime), subscription: Boolean(priceSubscription) };
}

export class StripeNotConfiguredError extends Error {}

export async function requireStripeClient(): Promise<Stripe> {
  const client = await getClient();
  if (!client) {
    throw new StripeNotConfiguredError(
      "Payments aren't configured yet — add a Secret Key in Admin > Billing, or set STRIPE_SECRET_KEY.",
    );
  }
  return client;
}
