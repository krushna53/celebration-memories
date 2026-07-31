import "server-only";
import Razorpay from "razorpay";

import { getRazorpaySettings } from "@/services/payment-settings";

/**
 * Thin wrapper around the Razorpay SDK — the alternative processor to
 * Stripe for the wizard's payment step (see services/billing-settings.ts
 * for how the active provider is chosen, and
 * features/start/actions/payment.ts for where this gets used).
 *
 * Credentials come from services/payment-settings.ts, which checks the
 * owner-editable `payment_provider_settings` DB row first (see
 * /admin/billing's "API Keys" section) and falls back to environment
 * variables if nothing's set there:
 *   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — Settings -> API Keys
 *   RAZORPAY_WEBHOOK_SECRET               — Settings -> Webhooks -> your endpoint
 *   RAZORPAY_PLAN_SUBSCRIPTION            — Subscriptions -> Plans -> your recurring plan's ID (plan_...)
 *   RAZORPAY_AMOUNT_ONE_TIME              — one-time price, in the smallest currency unit (paise for INR — e.g. 999900 = ₹9,999)
 *   RAZORPAY_CURRENCY                     — defaults to INR if unset
 * Creating the Razorpay account itself still has to be done by a human
 * — this just removes the "then redeploy to change a key" step
 * afterward.
 */
async function getClient(): Promise<Razorpay | null> {
  const { keyId, keySecret } = await getRazorpaySettings();
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function isRazorpayConfigured(): Promise<boolean> {
  const { keyId, keySecret } = await getRazorpaySettings();
  return Boolean(keyId && keySecret);
}

export async function getRazorpayPlansConfigured(): Promise<{ oneTime: boolean; subscription: boolean }> {
  const { amountOneTime, planSubscription } = await getRazorpaySettings();
  return { oneTime: Boolean(amountOneTime), subscription: Boolean(planSubscription) };
}

export class RazorpayNotConfiguredError extends Error {}

export async function requireRazorpayClient(): Promise<Razorpay> {
  const client = await getClient();
  if (!client) {
    throw new RazorpayNotConfiguredError(
      "Razorpay isn't configured yet — add a Key ID and Key Secret in Admin > Billing, or set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.",
    );
  }
  return client;
}
