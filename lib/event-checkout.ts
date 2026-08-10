import "server-only";
import Stripe from "stripe";
import Razorpay from "razorpay";
import crypto from "node:crypto";

import { buildCCAvenueRequestString, encryptCCAvenue } from "@/lib/ccavenue";
import type { EventPaymentSettingsRecord } from "@/types/event-payment-settings";

/**
 * Dynamic, per-event checkout builders — the RSVP-payment counterpart
 * to features/start/actions/payment.ts, but charging through an
 * EVENT'S OWN credentials (services/event-payment-settings.ts) instead
 * of the platform's global payment_provider_settings, and with a
 * per-guest amount computed at request time (lib/rsvp-pricing.ts)
 * rather than a pre-configured Stripe Price ID / fixed amount — so
 * Stripe uses `price_data` (inline) instead of a stored `price`.
 *
 * `amount` everywhere in this file is in the currency's MAJOR unit
 * (e.g. rupees, not paise) — matches how rsvpRegularPrice/
 * rsvpEarlyBirdPrice are entered in Event Settings. Converted to the
 * smallest unit only where the gateway's own SDK requires it
 * (Stripe/Razorpay); CCAvenue's own fields already expect major units,
 * same as features/start/actions/payment.ts's CCAvenue branch.
 */

const CCAVENUE_LIVE_URL = "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

export async function createEventStripeCheckoutUrl(params: {
  secretKey: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}): Promise<string> {
  const stripe = new Stripe(params.secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: params.description },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });

  if (!session.url) throw new Error("Stripe didn't return a checkout URL. Please try again.");
  return session.url;
}

/** Verifies a returning Stripe Checkout session actually paid, using the SAME event-scoped secret key the session was created with — no webhook needed since this only runs on the browser's own redirect back. */
export async function retrieveEventStripeSession(secretKey: string, sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = new Stripe(secretKey);
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function createEventRazorpayPaymentLink(params: {
  keyId: string;
  keySecret: string;
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail?: string;
  callbackUrl: string;
  notes: Record<string, string>;
}): Promise<string> {
  const razorpay = new Razorpay({ key_id: params.keyId, key_secret: params.keySecret });
  const paymentLink = await razorpay.paymentLink.create({
    amount: Math.round(params.amount * 100),
    currency: params.currency,
    description: params.description,
    customer: { name: params.customerName, email: params.customerEmail },
    notify: { email: Boolean(params.customerEmail), sms: false },
    callback_url: params.callbackUrl,
    callback_method: "get",
    notes: params.notes,
  });

  if (!paymentLink.short_url) throw new Error("Razorpay didn't return a payment URL. Please try again.");
  return paymentLink.short_url;
}

/**
 * Razorpay Payment Links' documented callback-signature check —
 * `HMAC-SHA256(payment_link_id|payment_link_reference_id|payment_link_status|razorpay_payment_id, key_secret)`
 * must equal `razorpay_signature`. Distinct from the webhook's
 * `Razorpay.validateWebhookSignature` (app/api/webhooks/razorpay/route.ts,
 * raw-body based) — this one verifies the browser's own GET-redirect
 * callback, so no webhook registration is needed for a per-event key.
 */
export function verifyRazorpayCallbackSignature(params: {
  keySecret: string;
  paymentLinkId: string;
  paymentLinkReferenceId: string;
  paymentLinkStatus: string;
  paymentId: string;
  signature: string;
}): boolean {
  const payload = `${params.paymentLinkId}|${params.paymentLinkReferenceId}|${params.paymentLinkStatus}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", params.keySecret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false; // length mismatch etc. — definitely not a match
  }
}

export function buildEventCCAvenueForm(params: {
  merchantId: string;
  accessCode: string;
  workingKey: string;
  amount: number;
  currency: string;
  orderId: string;
  responseUrl: string;
  cancelUrl: string;
  billingName: string;
  billingEmail?: string;
  merchantParam1: string;
}): { url: string; fields: Record<string, string> } {
  const requestString = buildCCAvenueRequestString({
    merchant_id: params.merchantId,
    order_id: params.orderId,
    currency: params.currency,
    amount: params.amount.toFixed(2),
    redirect_url: params.responseUrl,
    cancel_url: params.cancelUrl,
    language: "EN",
    billing_name: params.billingName,
    billing_email: params.billingEmail ?? "",
    merchant_param1: params.merchantParam1,
  });

  const encRequest = encryptCCAvenue(requestString, params.workingKey);
  return { url: CCAVENUE_LIVE_URL, fields: { encRequest, access_code: params.accessCode } };
}

/** Which credentials a settings row actually needs for its selected provider — mirrors isEventPaymentConfigured but returns the specific fields, for building a checkout request. Throws with a guest-safe message if something's missing (shouldn't happen for an "approved" row, but defends against a partially-cleared one). */
export function requireProviderCredentials(settings: EventPaymentSettingsRecord) {
  if (settings.provider === "stripe") {
    if (!settings.stripeSecretKey) throw new Error("This event's payment method isn't fully configured yet.");
    return { stripeSecretKey: settings.stripeSecretKey };
  }
  if (settings.provider === "razorpay") {
    if (!settings.razorpayKeyId || !settings.razorpayKeySecret) throw new Error("This event's payment method isn't fully configured yet.");
    return { razorpayKeyId: settings.razorpayKeyId, razorpayKeySecret: settings.razorpayKeySecret };
  }
  if (settings.provider === "ccavenue") {
    if (!settings.ccavenueMerchantId || !settings.ccavenueAccessCode || !settings.ccavenueWorkingKey) {
      throw new Error("This event's payment method isn't fully configured yet.");
    }
    return {
      ccavenueMerchantId: settings.ccavenueMerchantId,
      ccavenueAccessCode: settings.ccavenueAccessCode,
      ccavenueWorkingKey: settings.ccavenueWorkingKey,
    };
  }
  return {};
}
