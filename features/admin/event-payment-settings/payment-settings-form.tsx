"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Building2, CheckCircle2, Clock, CreditCard, Landmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { submitEventPaymentSettingsAction } from "@/features/admin/event-payment-settings/actions";
import type { EventPaymentProvider, EventPaymentSettingsInput, EventPaymentSettingsRecord } from "@/types/event-payment-settings";

const PROVIDERS: { value: EventPaymentProvider; label: string; icon: typeof Landmark }[] = [
  { value: "manual", label: "Bank / UPI", icon: Landmark },
  { value: "stripe", label: "Stripe", icon: CreditCard },
  { value: "razorpay", label: "Razorpay", icon: CreditCard },
  { value: "ccavenue", label: "CCAvenue", icon: Building2 },
];

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3.5 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const STATUS_COPY: Record<EventPaymentSettingsRecord["status"], { label: string; className: string; icon: typeof Clock }> = {
  pending_review: { label: "Pending review", className: "bg-gold-500/15 text-gold-700", icon: Clock },
  approved: { label: "Approved — live", className: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Needs changes", className: "bg-red-500/15 text-red-700", icon: AlertCircle },
};

/**
 * Client-facing "add your own payment method" form
 * (app/admin/(dashboard)/payment-settings-request/page.tsx) — a
 * submission always goes to "pending_review" (see
 * submitEventPaymentSettingsAction) until an owner approves it on
 * /admin/payment-settings-review. Secret fields are masked once saved
 * (e.g. "••••ab12") — leaving a masked field untouched on resubmit
 * keeps the existing value; typing a new value replaces it.
 */
export function PaymentSettingsForm({
  eventId,
  existing,
  scheduleItemId = null,
  sessionTitle = null,
}: {
  eventId: string;
  existing: EventPaymentSettingsRecord | null;
  /** Set only when this form is the per-session override (#63) — otherwise this edits the event's own default. */
  scheduleItemId?: string | null;
  sessionTitle?: string | null;
}) {
  const [provider, setProvider] = useState<EventPaymentProvider>(existing?.provider ?? "manual");
  const [bankDetails, setBankDetails] = useState(existing?.bankDetails ?? "");
  const [upiId, setUpiId] = useState(existing?.upiId ?? "");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [razorpayKeyId, setRazorpayKeyId] = useState(existing?.razorpayKeyId ?? "");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [ccavenueMerchantId, setCcavenueMerchantId] = useState(existing?.ccavenueMerchantId ?? "");
  const [ccavenueAccessCode, setCcavenueAccessCode] = useState(existing?.ccavenueAccessCode ?? "");
  const [ccavenueWorkingKey, setCcavenueWorkingKey] = useState("");
  const [currency, setCurrency] = useState(existing?.currency ?? "INR");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const input: EventPaymentSettingsInput = { provider, currency };
    if (provider === "manual") {
      input.bankDetails = bankDetails;
      input.upiId = upiId;
    } else if (provider === "stripe") {
      if (stripeSecretKey) input.stripeSecretKey = stripeSecretKey;
    } else if (provider === "razorpay") {
      input.razorpayKeyId = razorpayKeyId;
      if (razorpayKeySecret) input.razorpayKeySecret = razorpayKeySecret;
    } else {
      input.ccavenueMerchantId = ccavenueMerchantId;
      input.ccavenueAccessCode = ccavenueAccessCode;
      if (ccavenueWorkingKey) input.ccavenueWorkingKey = ccavenueWorkingKey;
    }

    startTransition(async () => {
      const result = await submitEventPaymentSettingsAction(eventId, input, scheduleItemId);
      if (result.success) {
        setSuccess(true);
        setStripeSecretKey("");
        setRazorpayKeySecret("");
        setCcavenueWorkingKey("");
      } else {
        setError(result.error);
      }
    });
  }

  const status = existing ? STATUS_COPY[existing.status] : null;
  const StatusIcon = status?.icon;

  return (
    <div className="max-w-xl">
      {sessionTitle ? (
        <p className="mb-4 text-sm text-navy-700/60">
          This overrides the event default for just <span className="font-medium text-navy-950">{sessionTitle}</span>.
        </p>
      ) : null}
      {status ? (
        <div className={`mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${status.className}`}>
          {StatusIcon ? <StatusIcon size={13} /> : null}
          {status.label}
        </div>
      ) : null}

      {existing?.status === "rejected" && existing.reviewNote ? (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700">
          <p className="font-medium">Sent back for changes:</p>
          <p className="mt-1">{existing.reviewNote}</p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-5">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.15em] text-navy-700/60">How should guests pay?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROVIDERS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setProvider(value)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-xs font-medium transition-colors ${
                  provider === value ? "border-gold-500 bg-gold-500/5 text-navy-950" : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {provider === "manual" ? (
          <>
            <div>
              <label htmlFor="upiId" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">UPI ID</label>
              <input id="upiId" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@bank" className={`${inputClasses} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="bankDetails" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Bank Details</label>
              <textarea
                id="bankDetails"
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                rows={3}
                placeholder="Account name, number, IFSC..."
                className={`${inputClasses} mt-1.5 resize-none`}
              />
            </div>
          </>
        ) : null}

        {provider === "stripe" ? (
          <div>
            <label htmlFor="stripeSecretKey" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Stripe Secret Key</label>
            <input
              id="stripeSecretKey"
              type="password"
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              placeholder={existing?.stripeSecretKey ? existing.stripeSecretKey : "sk_live_..."}
              className={`${inputClasses} mt-1.5`}
            />
            <p className="mt-1 text-xs text-navy-700/50">Leave blank to keep the key already on file.</p>
          </div>
        ) : null}

        {provider === "razorpay" ? (
          <>
            <div>
              <label htmlFor="razorpayKeyId" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Key ID</label>
              <input id="razorpayKeyId" value={razorpayKeyId} onChange={(e) => setRazorpayKeyId(e.target.value)} placeholder="rzp_live_..." className={`${inputClasses} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="razorpayKeySecret" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Key Secret</label>
              <input
                id="razorpayKeySecret"
                type="password"
                value={razorpayKeySecret}
                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                placeholder={existing?.razorpayKeySecret ? existing.razorpayKeySecret : "..."}
                className={`${inputClasses} mt-1.5`}
              />
              <p className="mt-1 text-xs text-navy-700/50">Leave blank to keep the secret already on file.</p>
            </div>
          </>
        ) : null}

        {provider === "ccavenue" ? (
          <>
            <div>
              <label htmlFor="ccavenueMerchantId" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Merchant ID</label>
              <input id="ccavenueMerchantId" value={ccavenueMerchantId} onChange={(e) => setCcavenueMerchantId(e.target.value)} className={`${inputClasses} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="ccavenueAccessCode" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Access Code</label>
              <input id="ccavenueAccessCode" value={ccavenueAccessCode} onChange={(e) => setCcavenueAccessCode(e.target.value)} className={`${inputClasses} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="ccavenueWorkingKey" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Working Key</label>
              <input
                id="ccavenueWorkingKey"
                type="password"
                value={ccavenueWorkingKey}
                onChange={(e) => setCcavenueWorkingKey(e.target.value)}
                placeholder={existing?.ccavenueWorkingKey ? existing.ccavenueWorkingKey : "..."}
                className={`${inputClasses} mt-1.5`}
              />
              <p className="mt-1 text-xs text-navy-700/50">Leave blank to keep the working key already on file.</p>
            </div>
          </>
        ) : null}

        {provider !== "manual" ? (
          <div>
            <label htmlFor="currency" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">Currency</label>
            <input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="INR" className={`${inputClasses} mt-1.5 w-24 uppercase`} />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        ) : null}
        {success ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 size={14} /> Submitted — the site owner will review it shortly.
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="animate-spin" size={16} /> : existing ? "Resubmit for Review" : "Submit for Review"}
        </Button>
      </form>
    </div>
  );
}
