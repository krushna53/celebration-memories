"use client";

import { useTransition, useState } from "react";
import { CheckCircle2, Loader2, Repeat, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction, type BillingPlan, type CheckoutPrereqs } from "@/features/start/actions/payment";

/**
 * Renders the "pay once" / "subscribe" choice on the wizard's payment
 * step (app/start/[token]/payment/page.tsx). createCheckoutSessionAction
 * redirects the browser to Stripe on success, so a "success" state here
 * would never actually render — only the error path shows anything back
 * in this component.
 */
export function PaymentPanel({
  token,
  eventId,
  prereqs,
}: {
  token: string;
  eventId: string;
  prereqs: CheckoutPrereqs;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choose(plan: BillingPlan) {
    setError(null);
    setPendingPlan(plan);
    startTransition(async () => {
      const result = await createCheckoutSessionAction(token, eventId, plan);
      // A successful call redirects server-side and never resolves here.
      if (result && !result.success) setError(result.error);
    });
  }

  if (!prereqs.stripeConfigured) {
    return (
      <p className="rounded-lg border border-navy-950/10 bg-white p-5 text-sm text-navy-700/70">
        Payments aren&rsquo;t configured yet on this site. Please contact the site owner.
      </p>
    );
  }

  if (!prereqs.accountEmail) {
    return (
      <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 p-5 text-sm text-navy-700/80">
        <p>
          Check your email and click the verification link to activate your account, then
          come back to this page to finish setting up billing.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {prereqs.oneTimeConfigured ? (
        <div className="rounded-xl border border-navy-950/10 bg-white p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
            <Zap size={16} />
          </div>
          <h2 className="mt-3 font-display text-lg text-navy-950">One-Time</h2>
          <p className="mt-1 text-sm text-navy-700/60">Pay once, keep your event site forever.</p>
          <Button
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => choose("one_time")}
          >
            {pending && pendingPlan === "one_time" ? <Loader2 className="animate-spin" size={16} /> : "Pay Once"}
          </Button>
        </div>
      ) : null}

      {prereqs.subscriptionConfigured ? (
        <div className="rounded-xl border border-navy-950/10 bg-white p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
            <Repeat size={16} />
          </div>
          <h2 className="mt-3 font-display text-lg text-navy-950">Subscription</h2>
          <p className="mt-1 text-sm text-navy-700/60">Lower upfront cost, billed monthly.</p>
          <Button
            variant="outline"
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => choose("subscription")}
          >
            {pending && pendingPlan === "subscription" ? <Loader2 className="animate-spin" size={16} /> : "Subscribe"}
          </Button>
        </div>
      ) : null}

      {!prereqs.oneTimeConfigured && !prereqs.subscriptionConfigured ? (
        <p className="text-sm text-navy-700/60 sm:col-span-2">
          No plans are configured yet. Please contact the site owner.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-navy-700/50 sm:col-span-2">
        <CheckCircle2 size={13} /> Secure checkout handled entirely by Stripe — your card details never touch this site.
      </p>
    </div>
  );
}
