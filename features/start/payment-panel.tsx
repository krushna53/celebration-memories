"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { CheckCircle2, ChevronDown, Loader2, QrCode, Repeat, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction, type BillingPlan, type CheckoutPrereqs } from "@/features/start/actions/payment";
import { redeemPromoCodeAction } from "@/features/start/actions/promo";
import { QrPaymentBlock } from "@/features/pay/qr-payment-block";
import { PayForm } from "@/features/pay/pay-form";
import type { PaymentSettingsRecord } from "@/types/payment";

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
  paymentSettings,
  qrImageUrl,
  initialPromoCode,
}: {
  token: string;
  eventId: string;
  prereqs: CheckoutPrereqs;
  /** Shown as a fallback ("scan to pay") when Stripe/Razorpay isn't configured — see /admin/payment-settings. */
  paymentSettings?: PaymentSettingsRecord;
  qrImageUrl?: string | null;
  /** Prefills and auto-opens the promo field — set from the cm_promo_code cookie a /pricing tier's CTA leaves behind. */
  initialPromoCode?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(Boolean(initialPromoCode));
  const [promoCode, setPromoCode] = useState(initialPromoCode ?? "");
  const [promoPending, setPromoPending] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  // "Prefer to pay via UPI/QR instead?" is always available as a
  // secondary option once a card processor is configured — it's the
  // primary path (rendered open, not behind this toggle) only when no
  // processor is configured at all; see the render logic below.
  const [qrOpen, setQrOpen] = useState(false);
  const ccavenueFormRef = useRef<HTMLFormElement>(null);
  const [ccavenueFields, setCcavenueFields] = useState<{ url: string; fields: Record<string, string> } | null>(null);

  function choose(plan: BillingPlan) {
    setError(null);
    setPendingPlan(plan);
    startTransition(async () => {
      const result = await createCheckoutSessionAction(token, eventId, plan);
      if (!result) return;
      if (!result.success) {
        setError(result.error);
        return;
      }
      // CCAvenue only: no redirect() is possible server-side for their
      // encrypted-form-POST flow, so the action hands back the fields
      // and the effect below auto-submits a hidden form to their
      // transaction URL once these are committed to the DOM.
      setCcavenueFields(result.formPost);
    });
  }

  useEffect(() => {
    if (ccavenueFields) ccavenueFormRef.current?.submit();
  }, [ccavenueFields]);

  async function redeemPromo(e: React.FormEvent) {
    e.preventDefault();
    setPromoError(null);
    setPromoPending(true);
    const result = await redeemPromoCodeAction(token, eventId, promoCode);
    setPromoPending(false);
    // A successful call redirects server-side and never resolves here.
    if (result && !result.success) setPromoError(result.error);
  }

  const cardCheckoutAvailable = prereqs.configured && (prereqs.oneTimeConfigured || prereqs.subscriptionConfigured);
  const providerLabel =
    prereqs.provider === "razorpay" ? "Razorpay" : prereqs.provider === "ccavenue" ? "CCAvenue" : "Stripe";

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

        {cardCheckoutAvailable ? null : (
          <div className="sm:col-span-2">
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 text-sm text-navy-700/80">
              <QrCode size={16} className="mt-0.5 shrink-0 text-gold-600" />
              <p>
                Card checkout isn&rsquo;t set up on this site yet — scan the QR code below to pay directly, then
                confirm your payment underneath so we can verify it.
              </p>
            </div>
            {paymentSettings ? (
              <div className="grid gap-5">
                <QrPaymentBlock settings={paymentSettings} qrImageUrl={qrImageUrl ?? null} />
                <PayForm />
              </div>
            ) : (
              <p className="text-sm text-navy-700/60">Payments aren&rsquo;t configured yet on this site. Please contact the site owner.</p>
            )}
          </div>
        )}

        {error ? (
          <p className="text-sm text-red-600 sm:col-span-2" role="alert">
            {error}
          </p>
        ) : null}

        {cardCheckoutAvailable ? (
          <p className="flex items-center gap-1.5 text-xs text-navy-700/50 sm:col-span-2">
            <CheckCircle2 size={13} /> Secure checkout handled entirely by{" "}
            {providerLabel} — your card details never touch this site.
          </p>
        ) : null}
      </div>

      {/* Hidden auto-submitting form for CCAvenue's encrypted-POST flow — see the choose() useEffect above. */}
      {ccavenueFields ? (
        <form ref={ccavenueFormRef} method="POST" action={ccavenueFields.url} className="hidden">
          {Object.entries(ccavenueFields.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      ) : null}

      {cardCheckoutAvailable ? (
        <div className="mt-6 border-t border-navy-950/10 pt-4">
          <button
            type="button"
            onClick={() => setQrOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-navy-700/40 hover:text-navy-700/70"
          >
            <ChevronDown size={12} className={qrOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            Prefer to pay via UPI / bank transfer instead?
          </button>
          {qrOpen ? (
            <div className="mt-3">
              {paymentSettings ? (
                <div className="grid gap-5">
                  <QrPaymentBlock settings={paymentSettings} qrImageUrl={qrImageUrl ?? null} />
                  <PayForm />
                </div>
              ) : (
                <p className="text-sm text-navy-700/60">UPI/bank transfer isn&rsquo;t set up on this site yet.</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

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
