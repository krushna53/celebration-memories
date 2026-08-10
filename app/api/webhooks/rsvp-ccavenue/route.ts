import { NextResponse } from "next/server";

import { decryptCCAvenue, parseCCAvenueResponseString } from "@/lib/ccavenue";
import { getRsvpPaymentById, markRsvpPaymentPaid, markRsvpPaymentFailed } from "@/services/rsvp-payments";
import { getEventPaymentSettingsRaw } from "@/services/event-payment-settings";
import { getInviteeById } from "@/services/invitees";
import { notifyAdminsOfRsvpPayment } from "@/services/admin-notifications";
import { getScheduleItemById } from "@/services/event-day";
import { createSessionRegistration } from "@/services/session-registrations";
import { SITE_URL } from "@/lib/constants";

/** Session-specific settings first, falling back to the event's own default — same precedence as initiateSessionRegistrationAction. */
async function resolvePaymentSettings(eventId: string, scheduleItemId: string | null) {
  if (scheduleItemId) {
    const sessionSettings = await getEventPaymentSettingsRaw(eventId, scheduleItemId);
    if (sessionSettings?.status === "approved") return sessionSettings;
  }
  return getEventPaymentSettingsRaw(eventId, null);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * CCAvenue's "Response URL" for a per-event (client-credential) RSVP
 * payment — the counterpart to app/api/webhooks/ccavenue/route.ts
 * (which handles the platform's OWN wizard checkout), decrypting with
 * this EVENT's own working key instead of the platform's. `paymentId`
 * travels in the query string set when the request was built
 * (features/rsvp-payment/actions.ts), not trusted from the decrypted
 * body alone — same re-resolve-from-a-known-id pattern as every other
 * token/id-gated flow in this app.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  const returnPath = url.searchParams.get("return") || "/";
  const returnUrl = new URL(returnPath, SITE_URL);

  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }

  const payment = await getRsvpPaymentById(paymentId);
  if (!payment) {
    return NextResponse.redirect(returnUrl);
  }
  if (payment.status === "paid") {
    // Already confirmed by an earlier delivery of the same response — CCAvenue can redirect more than once.
    return NextResponse.redirect(returnUrl);
  }

  const settings = await resolvePaymentSettings(payment.eventId, payment.scheduleItemId);
  if (!settings?.ccavenueWorkingKey) {
    await markRsvpPaymentFailed(paymentId);
    returnUrl.searchParams.set("ccavenue_error", "not_configured");
    return NextResponse.redirect(returnUrl);
  }

  const formData = await request.formData();
  const encResp = formData.get("encResp");
  if (typeof encResp !== "string") {
    await markRsvpPaymentFailed(paymentId);
    returnUrl.searchParams.set("ccavenue_error", "missing_response");
    return NextResponse.redirect(returnUrl);
  }

  let fields: Record<string, string>;
  try {
    fields = parseCCAvenueResponseString(decryptCCAvenue(encResp, settings.ccavenueWorkingKey));
  } catch (err) {
    console.error("RSVP CCAvenue response decryption failed:", err);
    await markRsvpPaymentFailed(paymentId);
    returnUrl.searchParams.set("ccavenue_error", "decrypt_failed");
    return NextResponse.redirect(returnUrl);
  }

  if (fields.order_status === "Success") {
    await markRsvpPaymentPaid(paymentId, fields.tracking_id || fields.order_id || null);

    const found = await getInviteeById(payment.inviteeId);
    if (found) {
      let sessionTitle: string | null = null;
      if (payment.scheduleItemId) {
        const session = await getScheduleItemById(payment.scheduleItemId);
        sessionTitle = session?.title ?? null;
        await createSessionRegistration({
          eventId: payment.eventId,
          scheduleItemId: payment.scheduleItemId,
          inviteeId: payment.inviteeId,
          rsvpPaymentId: payment.id,
        }).catch((err) => console.error("createSessionRegistration failed:", err));
      }
      notifyAdminsOfRsvpPayment({
        eventId: payment.eventId,
        guestName: found.invitee.name,
        amount: payment.amount,
        currency: payment.currency,
        needsReview: false,
        scheduleItemId: payment.scheduleItemId,
        sessionTitle,
      }).catch((err) => console.error("notifyAdminsOfRsvpPayment failed:", err));
    }

    return NextResponse.redirect(returnUrl);
  }

  await markRsvpPaymentFailed(paymentId);
  returnUrl.searchParams.set("ccavenue_error", fields.order_status === "Aborted" ? "cancelled" : "failed");
  return NextResponse.redirect(returnUrl);
}
