"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  initiateRsvpPaymentByTokenAction,
  initiateRsvpPaymentPublicAction,
  submitManualRsvpPaymentProofAction,
  type InitiateRsvpPaymentResult,
} from "@/features/rsvp-payment/actions";
import type { RsvpPrice } from "@/lib/rsvp-pricing";

type PaymentSource = { mode: "token"; token: string } | { mode: "public"; eventSlug: string; inviteeId: string };

/**
 * Shown after a "coming" RSVP is saved for a paid event (event.isPaidEvent)
 * — features/rsvp/rsvp-form.tsx (token flow) and public-rsvp-form.tsx
 * (public flow) both render this in place of/alongside their usual
 * thank-you card. `price` is computed server-side from the event
 * (lib/rsvp-pricing.ts) purely so the button can show a real amount —
 * the actual charge is always recomputed server-side in
 * initiateRsvpPayment, never trusted from this prop.
 */
export function RsvpPaymentPanel({ source, price }: { source: PaymentSource; price: RsvpPrice }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InitiateRsvpPaymentResult | null>(null);
  const [referenceNote, setReferenceNote] = useState("");
  const [proofPending, setProofPending] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const ccavenueFormRef = useRef<HTMLFormElement>(null);

  async function handlePayNow() {
    setPending(true);
    setError(null);
    const outcome =
      source.mode === "token"
        ? await initiateRsvpPaymentByTokenAction(source.token)
        : await initiateRsvpPaymentPublicAction(source.eventSlug, source.inviteeId);
    setPending(false);

    if (!outcome.success) {
      setError(outcome.error);
      return;
    }
    if (outcome.alreadyPaid) {
      setResult(outcome);
      return;
    }
    if (outcome.provider === "stripe" || outcome.provider === "razorpay") {
      window.location.href = outcome.redirectUrl;
      return;
    }
    setResult(outcome);
    if (outcome.provider === "ccavenue") {
      requestAnimationFrame(() => ccavenueFormRef.current?.submit());
    }
  }

  async function handleSubmitProof(paymentId: string) {
    setProofPending(true);
    setError(null);
    const outcome = await submitManualRsvpPaymentProofAction(paymentId, referenceNote);
    setProofPending(false);
    if (outcome.success) setProofSubmitted(true);
    else setError(outcome.error);
  }

  if (result?.success && result.alreadyPaid) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700">
        <CheckCircle2 size={16} /> You&rsquo;re already registered and paid.
      </div>
    );
  }

  if (result?.success && !result.alreadyPaid && result.provider === "manual") {
    if (proofSubmitted) {
      return (
        <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 text-sm text-navy-700/80">
          Thanks — we&rsquo;ll confirm your payment shortly.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-navy-950/10 bg-white p-5 text-left">
        <p className="flex items-center gap-1.5 text-sm font-medium text-navy-950">
          <QrCode size={15} /> Pay {result.currency} {result.amount}
        </p>
        {result.upiId ? (
          <p className="mt-2 text-sm text-navy-700/70">
            UPI: <span className="font-medium text-navy-950">{result.upiId}</span>
          </p>
        ) : null}
        {result.bankDetails ? <p className="mt-2 whitespace-pre-line text-sm text-navy-700/70">{result.bankDetails}</p> : null}
        <div className="mt-4">
          <input
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            placeholder="UTR / reference number"
            className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <Button
            className="mt-2"
            size="sm"
            disabled={proofPending || !referenceNote.trim()}
            onClick={() => handleSubmitProof(result.paymentId)}
          >
            {proofPending ? <Loader2 className="animate-spin" size={14} /> : "I've Paid — Submit for Confirmation"}
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (result?.success && !result.alreadyPaid && result.provider === "ccavenue") {
    return (
      <div className="rounded-xl border border-navy-950/10 bg-white p-5 text-sm text-navy-700/70">
        Redirecting you to complete payment…
        <form ref={ccavenueFormRef} method="POST" action={result.formPost.url} className="hidden">
          {Object.entries(result.formPost.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 text-left">
      <p className="text-sm text-navy-700/80">Complete payment to confirm your registration.</p>
      <Button className="mt-3" disabled={pending} onClick={handlePayNow}>
        {pending ? <Loader2 className="animate-spin" size={16} /> : `Pay ${price.currency} ${price.amount} Now`}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
