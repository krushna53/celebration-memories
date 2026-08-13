"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";

import { initiateSessionRegistrationAction, submitManualRsvpPaymentProofAction } from "@/features/rsvp-payment/actions";
import type { InitiateSessionRegistrationResult } from "@/features/rsvp-payment/actions";
import { CheckInCodeDisplay } from "@/features/event-day/check-in-code-display";
import type { RsvpPrice } from "@/lib/rsvp-pricing";

/**
 * Register / Register & Pay control for one Event Day schedule item —
 * the #63 counterpart to features/rsvp-payment/rsvp-payment-panel.tsx,
 * scoped to a single session instead of the whole event. Only rendered
 * when the guest's identity is known (the private, phone-verified
 * /event-day/[token] page) — the anonymous public homepage embed never
 * mounts this component.
 */
export function SessionRegisterButton({
  eventId,
  scheduleItemId,
  inviteeId,
  returnPath,
  price,
  initiallyRegistered,
  onRegistered,
}: {
  eventId: string;
  scheduleItemId: string;
  inviteeId: string;
  returnPath: string;
  price: RsvpPrice | null;
  initiallyRegistered: boolean;
  /** Fires once registration completes synchronously in this session (free, or already-registered) — NOT for redirect-based/pending-review payments, which only finalize later. Used by session-share-gate.tsx (#106) to refresh the linked form's ?regId= attribution without a page reload. */
  onRegistered?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InitiateSessionRegistrationResult | null>(null);
  const [registered, setRegistered] = useState(initiallyRegistered);
  const [referenceNote, setReferenceNote] = useState("");
  const [proofPending, setProofPending] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const ccavenueFormRef = useRef<HTMLFormElement>(null);

  async function handleRegister() {
    setPending(true);
    setError(null);
    const outcome = await initiateSessionRegistrationAction(eventId, scheduleItemId, inviteeId, returnPath);
    setPending(false);

    if (!outcome.success) {
      setError(outcome.error);
      return;
    }
    if (outcome.alreadyRegistered || outcome.free) {
      setRegistered(true);
      onRegistered?.();
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

  if (registered) {
    return (
      <div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-300">
          <CheckCircle2 size={13} /> You&rsquo;re registered for this session.
        </p>
        <CheckInCodeDisplay scheduleItemId={scheduleItemId} inviteeId={inviteeId} />
      </div>
    );
  }

  if (result?.success && !result.alreadyRegistered && !result.free && result.provider === "manual") {
    if (proofSubmitted) {
      return <p className="mt-3 text-xs text-ivory-100/60">Thanks — we&rsquo;ll confirm your payment shortly.</p>;
    }
    return (
      <div className="mt-3 rounded-lg border border-gold-500/20 bg-navy-900/40 p-3.5 text-left">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ivory-50">
          <QrCode size={13} /> Pay {result.currency} {result.amount}
        </p>
        {result.upiId ? (
          <p className="mt-1.5 text-xs text-ivory-100/60">
            UPI: <span className="font-medium text-ivory-50">{result.upiId}</span>
          </p>
        ) : null}
        {result.bankDetails ? <p className="mt-1.5 whitespace-pre-line text-xs text-ivory-100/60">{result.bankDetails}</p> : null}
        <div className="mt-2.5">
          <input
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            placeholder="UTR / reference number"
            className="w-full rounded-lg border border-gold-500/25 bg-navy-900/60 px-2.5 py-1.5 text-xs text-ivory-50 placeholder:text-ivory-100/40 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <button
            type="button"
            disabled={proofPending || !referenceNote.trim()}
            onClick={() => handleSubmitProof(result.paymentId)}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-1.5 text-xs font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            {proofPending ? <Loader2 className="animate-spin" size={12} /> : "I've Paid — Submit for Confirmation"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  }

  if (result?.success && !result.alreadyRegistered && !result.free && result.provider === "ccavenue") {
    return (
      <div className="mt-3 text-xs text-ivory-100/60">
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
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={handleRegister}
        className="flex items-center gap-1.5 rounded-full border border-gold-400/60 px-3.5 py-1.5 text-xs font-medium text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
      >
        {pending ? <Loader2 className="animate-spin" size={12} /> : price ? `Register & Pay ${price.currency} ${price.amount}` : "Register"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
