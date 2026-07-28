"use client";

import { useTransition, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Repeat, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction, type BillingPlan, type CheckoutPrereqs } from "@/features/start/actions/payment";
import { redeemPromoCodeAction } from "@/features/start/actions/promo";

/**
 * Renders the "pay once" / "subscribe" choice on the wizard's payment
 * step (app/start/[token]/payment/page.tsx), plus a low-key promo code
 * entry. Both createCheckoutSessionAction and redeemPromoCodeAction
 * redirect the browser on success, so a "success" state here would
 * never actually render — only the error path shows anything back in
 * this component.
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
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoPending, setPromoPending] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  function choose(plan: BillingPlan) {
    setError(null);
    setPendingPlan(plan);
    startTransition(async () => {
      const result = await createCheckoutSessionAction(token, eventId, plan);
      // A successful call redirects server-side and never resolves here.
      if (result && !result.success) setError(result.error);
    });
  }

  async function redeemPromo(e: React.FormEvent) {
    e.preventDefault();
    setPromoError(null);
    setPromoPending(true);
    const result = await redeemPromoCodeAction(token, eventId, promoCode);
    setPromoPending(false);
    // A successful call redirects server-side and never resolves here.
    if (result && !result.success) setPromoError(result.error);
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
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {prereqs.configured && prereqs.oneTimeConfigured ? (
          <div className="rounded-xl border border-navy-950/10 bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
              <Zap size={16} />
            </div>
            <h2 className="mt-3 font-display text-lg text-navy-950">One-Time</h2>
            <p className="mt-1 text-sm text-navy-700/60">Pay once, keep your event site forever.</p>
            <Button className="mt-4 w-full" disabled={pending} onClick={() => choose("one_time")}>
              {pending && pendingPlan === "one_time" ? <Loader2 className="animate-spin" size={16} /> : "Pay Once"}
            </Button>
          </div>
        ) : null}

        {prereqs.configured && prereqs.subscriptionConfigured ? (
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

        {!prereqs.configured || (!prereqs.oneTimeConfigured && !prereqs.subscriptionConfigured) ? (
          <p className="text-sm text-navy-700/60 sm:col-span-2">
            Payments aren&rsquo;t configured yet on this site. Please contact the site owner.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 sm:col-span-2" role="alert">
            {error}
          </p>
        ) : null}

        <p className="flex items-center gap-1.5 text-xs text-navy-700/50 sm:col-span-2">
          <CheckCircle2 size={13} /> Secure checkout handled entirely by{" "}
          {prereqs.provider === "razorpay" ? "Razorpay" : "Stripe"} — your card details never touch this site.
        </p>
      </div>

      <div className="mt-6 border-t border-navy-950/10 pt-4">
        <button
          type="button"
          onClick={() => setPromoOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-navy-700/40 hover:text-navy-700/70"
        >
          <ChevronDown size={12} className={promoOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          Have a promo code?
        </button>
        {promoOpen ? (
          <form onSubmit={redeemPromo} className="mt-3 flex max-w-xs gap-2">
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="PROMO CODE"
              className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm uppercase text-navy-950 placeholder:text-navy-700/30 placeholder:normal-case focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            />
            <Button type="submit" variant="outline" size="sm" disabled={promoPending || !promoCode.trim()}>
              {promoPending ? <Loader2 className="animate-spin" size={14} /> : "Apply"}
            </Button>
          </form>
        ) : null}
        {promoError ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {promoError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
