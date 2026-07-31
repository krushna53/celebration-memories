"use server";

import { redirect } from "next/navigation";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { getAdminByEventId } from "@/services/admin-auth";
import { getBillingProvider, type BillingProvider } from "@/services/billing-settings";
import { recordWizardPayment } from "@/services/wizard-payments";
import { requireStripeClient, isStripeConfigured, getStripePlansConfigured, StripeNotConfiguredError } from "@/lib/stripe";
import { requireRazorpayClient, isRazorpayConfigured, getRazorpayPlansConfigured, RazorpayNotConfiguredError } from "@/lib/razorpay";
import {
  isCCAvenueConfigured,
  isCCAvenueOneTimeConfigured,
  getCCAvenueTransactionUrl,
  buildCCAvenueRequestString,
  encryptCCAvenue,
} from "@/lib/ccavenue";
import { getStripeSettings, getRazorpaySettings, getCCAvenueSettings } from "@/services/payment-settings";
import { SITE_URL } from "@/lib/constants";
import { wizardStepHref } from "@/features/start/wizard-steps";

export type BillingPlan = "one_time" | "subscription";

export interface CheckoutPrereqs {
  provider: BillingProvider;
  configured: boolean;
  oneTimeConfigured: boolean;
  subscriptionConfigured: boolean;
  /** Null until the host verifies their email — see handle_new_confirmed_admin trigger. */
  accountEmail: string | null;
}

/** What the payment page needs to know before rendering its plan buttons. */
export async function getCheckoutPrereqs(token: string, eventId: string): Promise<CheckoutPrereqs> {
  const event = await requireDraftEvent(token);
  if (event.id !== eventId) throw new Error("This link doesn't match that event.");

  const [admin, provider] = await Promise.all([getAdminByEventId(event.id), getBillingProvider()]);

  let plans: { oneTime: boolean; subscription: boolean };
  let configured: boolean;
  if (provider === "stripe") {
    [plans, configured] = await Promise.all([getStripePlansConfigured(), isStripeConfigured()]);
  } else if (provider === "razorpay") {
    [plans, configured] = await Promise.all([getRazorpayPlansConfigured(), isRazorpayConfigured()]);
  } else {
    [plans, configured] = await Promise.all([
      isCCAvenueOneTimeConfigured().then((oneTime) => ({ oneTime, subscription: false })),
      isCCAvenueConfigured(),
    ]);
  }

  return {
    provider,
    configured,
    oneTimeConfigured: plans.oneTime,
    subscriptionConfigured: plans.subscription,
    accountEmail: admin?.email ?? null,
  };
}

export type CreateCheckoutResult =
  | { success: false; error: string }
  /**
   * Only ever returned for CCAvenue: unlike Stripe/Razorpay (a hosted
   * checkout URL this action redirects to directly), CCAvenue's kit
   * requires the browser to HTML-form-POST the encrypted payload to
   * their transaction endpoint — a server-side redirect() can't do a
   * POST, so the caller (features/start/payment-panel.tsx) renders and
   * auto-submits a hidden form with these fields instead.
   */
  | { success: true; formPost: { url: string; fields: Record<string, string> } };

/**
 * Creates a checkout session with whichever processor is currently
 * active (services/billing-settings.ts). For Stripe/Razorpay, redirects
 * the browser straight to their hosted checkout/payment page — no card
 * data ever touches this app's own code either way; for CCAvenue,
 * returns form-POST fields instead (see CreateCheckoutResult above). On
 * success, the flow eventually lands on /start/success?slug=...
 * (deliberately outside the /start/[token]/... layout, since the
 * webhook/response handler may have already flipped this draft to
 * 'active' by the time the browser gets there, which would otherwise
 * trip the "link no longer active" screen). See
 * app/api/webhooks/stripe/route.ts, app/api/webhooks/razorpay/route.ts,
 * and app/api/webhooks/ccavenue/route.ts for what actually claims the
 * draft and records the payment in each case.
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

  const provider = await getBillingProvider();
  const paymentPath = wizardStepHref(token, "payment");
  const successUrl = `${SITE_URL}/start/success?slug=${encodeURIComponent(event.slug)}`;
  const cancelUrl = `${SITE_URL}${paymentPath}`;

  if (provider === "razorpay") {
    return createRazorpayCheckout({ token, eventId: event.id, plan, adminEmail: admin.email, adminName: admin.name, successUrl, cancelUrl });
  }
  if (provider === "ccavenue") {
    return createCCAvenueCheckout({ token, eventId: event.id, plan, adminEmail: admin.email, adminName: admin.name, cancelUrl });
  }
  return createStripeCheckout({ token, eventId: event.id, plan, adminEmail: admin.email, successUrl, cancelUrl });
}

async function createStripeCheckout(params: {
  token: string;
  eventId: string;
  plan: BillingPlan;
  adminEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CreateCheckoutResult> {
  const { token, eventId, plan, adminEmail, successUrl, cancelUrl } = params;

  let stripe;
  try {
    stripe = await requireStripeClient();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return { success: false, error: err.message };
    throw err;
  }

  const { priceOneTime, priceSubscription } = await getStripeSettings();
  const priceId = plan === "one_time" ? priceOneTime : priceSubscription;
  if (!priceId) {
    return { success: false, error: `The ${plan === "one_time" ? "one-time" : "subscription"} plan isn't configured yet.` };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: plan === "one_time" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: adminEmail,
      // Lets the owner create discount/free-trial coupons directly in
      // the Stripe Dashboard (Product catalog -> Coupons) and hand out
      // the code, without any code change here — shown as a "have a
      // promo code?" link on Stripe's own hosted checkout page. This is
      // separate from and in addition to this app's own promo_codes
      // system (features/start/actions/promo.ts), which bypasses
      // checkout entirely instead of discounting it.
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { eventId, draftToken: token },
      subscription_data: plan === "subscription" ? { metadata: { eventId } } : undefined,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start checkout." };
  }

  if (!session.url) return { success: false, error: "Stripe didn't return a checkout URL. Please try again." };
  redirect(session.url);
}

async function createRazorpayCheckout(params: {
  token: string;
  eventId: string;
  plan: BillingPlan;
  adminEmail: string;
  adminName: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<CreateCheckoutResult> {
  const { eventId, plan, adminEmail, adminName, successUrl } = params;

  let razorpay;
  try {
    razorpay = await requireRazorpayClient();
  } catch (err) {
    if (err instanceof RazorpayNotConfiguredError) return { success: false, error: err.message };
    throw err;
  }

  const razorpaySettings = await getRazorpaySettings();
  const customer = { name: adminName || adminEmail, email: adminEmail };

  // redirect() throws a special Next.js control-flow error that must
  // NOT be caught below — so every Razorpay API call happens inside
  // this try block, and the resulting URL is only redirected to after
  // the try/catch has fully exited.
  let checkoutUrl: string;
  try {
    if (plan === "subscription") {
      const planId = razorpaySettings.planSubscription;
      if (!planId) return { success: false, error: "The subscription plan isn't configured yet." };

      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        // Razorpay subscriptions require a fixed number of billing
        // cycles rather than "until cancelled" — 120 monthly cycles
        // (10 years) stands in for indefinite; cancel anytime from the
        // Razorpay dashboard or a future admin action.
        total_count: 120,
        customer_notify: 1,
        notes: { eventId, draftToken: params.token },
      });

      if (!subscription.short_url) {
        return { success: false, error: "Razorpay didn't return a payment URL. Please try again." };
      }
      checkoutUrl = subscription.short_url;
    } else {
      const amount = razorpaySettings.amountOneTime;
      if (!amount) return { success: false, error: "The one-time plan isn't configured yet." };

      const paymentLink = await razorpay.paymentLink.create({
        amount,
        currency: razorpaySettings.currency,
        description: "Celebration Memories — event site (one-time)",
        customer,
        notify: { email: true, sms: false },
        callback_url: successUrl,
        callback_method: "get",
        notes: { eventId, draftToken: params.token },
      });

      if (!paymentLink.short_url) {
        return { success: false, error: "Razorpay didn't return a payment URL. Please try again." };
      }
      checkoutUrl = paymentLink.short_url;
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start checkout." };
  }

  redirect(checkoutUrl);
}

async function createCCAvenueCheckout(params: {
  token: string;
  eventId: string;
  plan: BillingPlan;
  adminEmail: string;
  adminName: string | null;
  cancelUrl: string;
}): Promise<CreateCheckoutResult> {
  const { token, eventId, plan, adminEmail, adminName, cancelUrl } = params;

  if (plan === "subscription") {
    return {
      success: false,
      error: "Subscriptions aren't available with CCAvenue yet — choose the one-time plan, or switch processors in Admin > Billing.",
    };
  }

  if (!(await isCCAvenueConfigured())) {
    return { success: false, error: "CCAvenue isn't configured yet — add your Merchant ID, Access Code, and Working Key in Admin > Billing." };
  }

  const settings = await getCCAvenueSettings();
  if (!settings.amountOneTime) {
    return { success: false, error: "The one-time plan isn't configured yet." };
  }
  // CCAvenue's `amount` field is in the currency's major unit (e.g.
  // "9999.00"), unlike Stripe/Razorpay's smallest-unit convention —
  // ccavenue_amount_one_time is stored the same way as the other two
  // (paise) for consistency across the settings table, so it's
  // converted here rather than asking the owner to enter a different
  // unit just for this one provider.
  const amountMajor = (settings.amountOneTime / 100).toFixed(2);

  // CCAvenue POSTs its encrypted response back to exactly this URL
  // (see app/api/webhooks/ccavenue/route.ts) — draftToken travels in the
  // query string since that response route needs to re-resolve the
  // draft the same secure way every other draft-scoped action does
  // (requireDraftEvent), rather than trusting eventId/merchant_param
  // values pulled out of the decrypted body alone.
  const responseUrl = `${SITE_URL}/api/webhooks/ccavenue?draftToken=${encodeURIComponent(token)}`;

  const orderId = `${eventId.slice(0, 8)}-${Date.now()}`;
  const requestString = buildCCAvenueRequestString({
    merchant_id: settings.merchantId!,
    order_id: orderId,
    currency: settings.currency,
    amount: amountMajor,
    redirect_url: responseUrl,
    cancel_url: cancelUrl,
    language: "EN",
    billing_name: adminName || adminEmail,
    billing_email: adminEmail,
    merchant_param1: eventId,
  });

  const encRequest = encryptCCAvenue(requestString, settings.workingKey!);
  const url = await getCCAvenueTransactionUrl();

  return {
    success: true,
    formPost: { url, fields: { encRequest, access_code: settings.accessCode! } },
  };
}

/** Re-exported for the webhook route, which records the payment after actually confirming it. */
export { recordWizardPayment };
