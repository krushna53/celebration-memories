import { NextResponse } from "next/server";

import { isCCAvenueConfigured } from "@/lib/ccavenue";
import { decryptCCAvenue, parseCCAvenueResponseString } from "@/lib/ccavenue";
import { getCCAvenueSettings } from "@/services/payment-settings";
import { getDraftEventByToken, claimDraftEvent } from "@/services/event-drafts";
import { recordWizardPayment } from "@/services/wizard-payments";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * CCAvenue's "Response URL" — configured dynamically per-transaction as
 * part of the encrypted request (see features/start/actions/payment.ts's
 * createCCAvenueCheckout), unlike Stripe/Razorpay's dashboard-configured
 * webhook endpoints. CCAvenue redirects the *browser* here via an
 * auto-submitted POST once the shopper finishes on their hosted page —
 * this isn't a pure server-to-server webhook, so the handler ends by
 * redirecting the browser onward rather than just acknowledging receipt.
 *
 * `draftToken` travels in this URL's own query string (set when the
 * request was built) rather than trusting the decrypted body's
 * merchant_param1 as the sole source of truth — re-resolving the draft
 * via getDraftEventByToken() is the same secure lookup every other
 * draft-scoped action in the wizard uses.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const draftToken = url.searchParams.get("draftToken");

  if (!draftToken) {
    return NextResponse.json({ error: "Missing draft token." }, { status: 400 });
  }

  const paymentPageUrl = new URL(wizardStepHref(draftToken, "payment"), SITE_URL);

  if (!(await isCCAvenueConfigured())) {
    paymentPageUrl.searchParams.set("ccavenue_error", "not_configured");
    return NextResponse.redirect(paymentPageUrl);
  }

  const formData = await request.formData();
  const encResp = formData.get("encResp");
  if (typeof encResp !== "string") {
    paymentPageUrl.searchParams.set("ccavenue_error", "missing_response");
    return NextResponse.redirect(paymentPageUrl);
  }

  const { workingKey } = await getCCAvenueSettings();
  if (!workingKey) {
    paymentPageUrl.searchParams.set("ccavenue_error", "not_configured");
    return NextResponse.redirect(paymentPageUrl);
  }

  let fields: Record<string, string>;
  try {
    fields = parseCCAvenueResponseString(decryptCCAvenue(encResp, workingKey));
  } catch (err) {
    console.error("CCAvenue response decryption failed:", err);
    paymentPageUrl.searchParams.set("ccavenue_error", "decrypt_failed");
    return NextResponse.redirect(paymentPageUrl);
  }

  const event = await getDraftEventByToken(draftToken);
  if (!event) {
    // Either an invalid token, or (the common harmless case) this draft
    // was already claimed by an earlier delivery of the same response —
    // CCAvenue can redirect the browser here more than once.
    return NextResponse.redirect(new URL(`/start/success`, SITE_URL));
  }

  if (fields.order_status === "Success") {
    await claimDraftEvent(event.id);
    await recordWizardPayment({
      eventId: event.id,
      adminId: null,
      provider: "ccavenue",
      plan: "one_time",
      amount: Math.round(parseFloat(fields.amount || "0") * 100),
      currency: fields.currency || "INR",
      externalId: fields.tracking_id || fields.order_id || null,
    });

    const successUrl = new URL("/start/success", SITE_URL);
    successUrl.searchParams.set("slug", event.slug);
    return NextResponse.redirect(successUrl);
  }

  paymentPageUrl.searchParams.set("ccavenue_error", fields.order_status === "Aborted" ? "cancelled" : "failed");
  if (fields.failure_message) paymentPageUrl.searchParams.set("ccavenue_message", fields.failure_message);
  return NextResponse.redirect(paymentPageUrl);
}
