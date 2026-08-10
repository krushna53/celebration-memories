import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { getRsvpPaymentById, markRsvpPaymentPaid, markRsvpPaymentFailed } from "@/services/rsvp-payments";
import { getEventPaymentSettingsRaw } from "@/services/event-payment-settings";
import { getInviteeById } from "@/services/invitees";
import { notifyAdminsOfRsvpPayment } from "@/services/admin-notifications";
import { retrieveEventStripeSession, verifyRazorpayCallbackSignature } from "@/lib/event-checkout";
import { SiteShell } from "@/components/layout/site-shell";

export const dynamic = "force-dynamic";

interface ConfirmPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function str(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Where the browser lands back after a per-event Stripe Checkout
 * session or Razorpay Payment Link — verifies the payment actually
 * succeeded using the SAME event-scoped credentials it was created
 * with (no webhook registration needed for a per-client key; see
 * lib/event-checkout.ts). CCAvenue has its own POST-based return
 * (app/api/webhooks/rsvp-ccavenue/route.ts) since CCAvenue's kit
 * redirects via an auto-submitted form, not a GET query string.
 */
export default async function RsvpPaymentConfirmPage({ searchParams }: ConfirmPageProps) {
  const params = await searchParams;
  const paymentId = str(params.paymentId);
  const provider = str(params.provider);
  const returnPath = str(params.return) || "/";

  const payment = paymentId ? await getRsvpPaymentById(paymentId) : null;

  let outcome: "paid" | "failed" | "invalid" = "invalid";

  if (payment) {
    if (payment.status === "paid") {
      outcome = "paid";
    } else if (provider === "stripe") {
      const sessionId = str(params.session_id);
      const settings = sessionId ? await getEventPaymentSettingsRaw(payment.eventId) : null;
      if (sessionId && settings?.stripeSecretKey) {
        try {
          const session = await retrieveEventStripeSession(settings.stripeSecretKey, sessionId);
          if (session.payment_status === "paid") {
            await markRsvpPaymentPaid(payment.id, session.id);
            outcome = "paid";
          } else {
            outcome = "failed";
          }
        } catch (err) {
          console.error("retrieveEventStripeSession failed:", err);
          outcome = "failed";
        }
      } else {
        outcome = "failed";
      }
    } else if (provider === "razorpay") {
      const paymentLinkId = str(params.razorpay_payment_link_id);
      const paymentLinkRefId = str(params.razorpay_payment_link_reference_id);
      const paymentLinkStatus = str(params.razorpay_payment_link_status);
      const razorpayPaymentId = str(params.razorpay_payment_id);
      const signature = str(params.razorpay_signature);
      const settings = await getEventPaymentSettingsRaw(payment.eventId);

      if (paymentLinkId && paymentLinkRefId && paymentLinkStatus && razorpayPaymentId && signature && settings?.razorpayKeySecret) {
        const valid = verifyRazorpayCallbackSignature({
          keySecret: settings.razorpayKeySecret,
          paymentLinkId,
          paymentLinkReferenceId: paymentLinkRefId,
          paymentLinkStatus,
          paymentId: razorpayPaymentId,
          signature,
        });
        if (valid && paymentLinkStatus === "paid") {
          await markRsvpPaymentPaid(payment.id, razorpayPaymentId);
          outcome = "paid";
        } else {
          outcome = "failed";
        }
      } else {
        outcome = "failed";
      }
    }

    if (outcome === "failed" && payment.status === "pending") {
      await markRsvpPaymentFailed(payment.id);
    }

    if (outcome === "paid") {
      const found = await getInviteeById(payment.inviteeId);
      if (found) {
        notifyAdminsOfRsvpPayment({
          eventId: payment.eventId,
          guestName: found.invitee.name,
          amount: payment.amount,
          currency: payment.currency,
          needsReview: false,
        }).catch((err) => console.error("notifyAdminsOfRsvpPayment failed:", err));
      }
    }
  }

  return (
    <SiteShell footerVariant="minimal">
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-24 text-center">
        {outcome === "paid" ? (
          <>
            <CheckCircle2 className="text-gold-500" size={40} />
            <h1 className="mt-4 font-display text-2xl text-navy-950">Payment received</h1>
            <p className="mt-2 text-sm text-navy-700/70">Your registration is confirmed — thank you!</p>
          </>
        ) : outcome === "failed" ? (
          <>
            <XCircle className="text-red-500" size={40} />
            <h1 className="mt-4 font-display text-2xl text-navy-950">Payment didn&rsquo;t go through</h1>
            <p className="mt-2 text-sm text-navy-700/70">No charge was completed — please try again.</p>
          </>
        ) : (
          <>
            <Loader2 className="text-navy-700/40" size={40} />
            <h1 className="mt-4 font-display text-2xl text-navy-950">We couldn&rsquo;t verify that payment</h1>
            <p className="mt-2 text-sm text-navy-700/70">Please return and try again, or contact the host.</p>
          </>
        )}
        <Link href={returnPath} className="mt-6 text-sm text-gold-600 underline underline-offset-4 hover:text-gold-500">
          Back to the event
        </Link>
      </div>
    </SiteShell>
  );
}
