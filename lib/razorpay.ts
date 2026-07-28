import "server-only";
import Razorpay from "razorpay";

/**
 * Thin wrapper around the Razorpay SDK — the alternative processor to
 * Stripe for the wizard's payment step (see services/billing-settings.ts
 * for how the active provider is chosen, and
 * features/start/actions/payment.ts for where this gets used). Returns
 * null when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET aren't set so the
 * payment page degrades to a clear "not configured" message — same
 * pattern as lib/stripe.ts and lib/ai-image.ts.
 *
 * Setup (all values come from https://dashboard.razorpay.com):
 *   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — Settings -> API Keys
 *   RAZORPAY_WEBHOOK_SECRET               — Settings -> Webhooks -> your endpoint
 *   RAZORPAY_PLAN_SUBSCRIPTION            — Subscriptions -> Plans -> your recurring plan's ID (plan_...)
 *   RAZORPAY_AMOUNT_ONE_TIME              — one-time price, in the smallest currency unit (paise for INR — e.g. 999900 = ₹9,999)
 *   RAZORPAY_CURRENCY                     — defaults to INR if unset
 * None of these can be created by an AI assistant — creating a Razorpay
 * account and entering real bank/API credentials has to be done by a
 * human. See the README's "Billing" section.
 */
function getClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export const RAZORPAY_CONFIGURED = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const RAZORPAY_PLANS_CONFIGURED = {
  oneTime: Boolean(process.env.RAZORPAY_AMOUNT_ONE_TIME),
  subscription: Boolean(process.env.RAZORPAY_PLAN_SUBSCRIPTION),
};

export class RazorpayNotConfiguredError extends Error {}

export function requireRazorpayClient(): Razorpay {
  const client = getClient();
  if (!client) {
    throw new RazorpayNotConfiguredError(
      "Razorpay isn't configured yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable it.",
    );
  }
  return client;
}
