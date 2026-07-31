"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateRazorpaySettingsAction, updateStripeSettingsAction } from "@/features/admin/billing/actions";
import type { PaymentSettingsSummary } from "@/services/payment-settings";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium text-navy-700/70";

function SourceHint({ summary }: { summary: { value: string | null; source: "database" | "env" | "none" } }) {
  if (summary.source === "none") {
    return <p className="mt-1 text-xs text-navy-700/40">Not set.</p>;
  }
  return (
    <p className="mt-1 text-xs text-navy-700/40">
      Currently: <span className="font-mono">{summary.value}</span>{" "}
      {summary.source === "env" ? "(from environment variable)" : "(saved here)"}
    </p>
  );
}

/**
 * Owner-only form for /admin/billing's "API Keys" section — two
 * independent sub-forms (Razorpay, Stripe) so saving one never touches
 * the other. Secret fields (key secret, webhook secrets) always start
 * blank with a masked preview shown below rather than prefilled, so
 * re-submitting without editing them can't accidentally overwrite the
 * real secret with its own masked display value — only non-secret
 * fields (key ID, currency, price/plan IDs) are prefilled directly.
 * Blank fields are omitted from the request entirely (see
 * updateRazorpaySettingsAction/updateStripeSettingsAction), so leaving
 * a secret field empty always means "no change."
 */
export function ApiKeysForm({ summary }: { summary: PaymentSettingsSummary }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RazorpaySection summary={summary} />
      <StripeSection summary={summary} />
    </div>
  );
}

function RazorpaySection({ summary }: { summary: PaymentSettingsSummary }) {
  const [keyId, setKeyId] = useState(summary.razorpayKeyId.source !== "none" ? summary.razorpayKeyId.value ?? "" : "");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [planSubscription, setPlanSubscription] = useState(
    summary.razorpayPlanSubscription.source !== "none" ? summary.razorpayPlanSubscription.value ?? "" : "",
  );
  const [amountOneTime, setAmountOneTime] = useState(
    summary.razorpayAmountOneTime.source !== "none" ? summary.razorpayAmountOneTime.value ?? "" : "",
  );
  const [currency, setCurrency] = useState(summary.razorpayCurrency.value ?? "INR");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await updateRazorpaySettingsAction({
        ...(keyId.trim() ? { keyId: keyId.trim() } : {}),
        ...(keySecret.trim() ? { keySecret: keySecret.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        ...(planSubscription.trim() ? { planSubscription: planSubscription.trim() } : {}),
        ...(amountOneTime.trim() ? { amountOneTime: Number(amountOneTime.trim()) } : {}),
        ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
      });
      if (result.success) {
        setStatus("saved");
        setKeySecret("");
        setWebhookSecret("");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-navy-950/10 p-4">
      <h3 className="font-medium text-navy-950">Razorpay</h3>

      <div className="mt-3 grid gap-3">
        <div>
          <label className={labelClasses}>Key ID</label>
          <input value={keyId} onChange={(e) => setKeyId(e.target.value)} className={`${inputClasses} mt-1`} placeholder="rzp_test_..." />
        </div>
        <div>
          <label className={labelClasses}>Key Secret</label>
          <input
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="Leave blank to keep current"
          />
          <SourceHint summary={summary.razorpayKeySecret} />
        </div>
        <div>
          <label className={labelClasses}>Webhook Secret</label>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="Leave blank to keep current"
          />
          <SourceHint summary={summary.razorpayWebhookSecret} />
        </div>
        <div>
          <label className={labelClasses}>Subscription Plan ID</label>
          <input
            value={planSubscription}
            onChange={(e) => setPlanSubscription(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="plan_..."
          />
        </div>
        <div>
          <label className={labelClasses}>One-Time Amount (smallest unit, e.g. paise — 999900 = ₹9,999)</label>
          <input
            type="number"
            min={0}
            value={amountOneTime}
            onChange={(e) => setAmountOneTime(e.target.value)}
            className={`${inputClasses} mt-1`}
          />
        </div>
        <div>
          <label className={labelClasses}>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputClasses} mt-1`} placeholder="INR" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Razorpay
        </Button>
        {status === "saved" ? <span className="text-sm text-emerald-600">Saved.</span> : null}
        {status === "error" && error ? (
          <span className="text-sm text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StripeSection({ summary }: { summary: PaymentSettingsSummary }) {
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [priceOneTime, setPriceOneTime] = useState(
    summary.stripePriceOneTime.source !== "none" ? summary.stripePriceOneTime.value ?? "" : "",
  );
  const [priceSubscription, setPriceSubscription] = useState(
    summary.stripePriceSubscription.source !== "none" ? summary.stripePriceSubscription.value ?? "" : "",
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await updateStripeSettingsAction({
        ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        ...(priceOneTime.trim() ? { priceOneTime: priceOneTime.trim() } : {}),
        ...(priceSubscription.trim() ? { priceSubscription: priceSubscription.trim() } : {}),
      });
      if (result.success) {
        setStatus("saved");
        setSecretKey("");
        setWebhookSecret("");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-navy-950/10 p-4">
      <h3 className="font-medium text-navy-950">Stripe</h3>

      <div className="mt-3 grid gap-3">
        <div>
          <label className={labelClasses}>Secret Key</label>
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="Leave blank to keep current"
          />
          <SourceHint summary={summary.stripeSecretKey} />
        </div>
        <div>
          <label className={labelClasses}>Webhook Secret</label>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="Leave blank to keep current"
          />
          <SourceHint summary={summary.stripeWebhookSecret} />
        </div>
        <div>
          <label className={labelClasses}>One-Time Price ID</label>
          <input
            value={priceOneTime}
            onChange={(e) => setPriceOneTime(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="price_..."
          />
        </div>
        <div>
          <label className={labelClasses}>Subscription Price ID</label>
          <input
            value={priceSubscription}
            onChange={(e) => setPriceSubscription(e.target.value)}
            className={`${inputClasses} mt-1`}
            placeholder="price_..."
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Stripe
        </Button>
        {status === "saved" ? <span className="text-sm text-emerald-600">Saved.</span> : null}
        {status === "error" && error ? (
          <span className="text-sm text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
