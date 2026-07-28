"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { setBillingProviderAction } from "@/features/admin/billing/actions";
import type { BillingProvider } from "@/services/billing-settings";

const OPTIONS: { value: BillingProvider; label: string; blurb: string }[] = [
  { value: "stripe", label: "Stripe", blurb: "Card checkout, global — the default." },
  { value: "razorpay", label: "Razorpay", blurb: "Popular in India, supports UPI/cards/netbanking." },
];

export function ProviderSwitcher({
  currentProvider,
  stripeConfigured,
  razorpayConfigured,
}: {
  currentProvider: BillingProvider;
  stripeConfigured: boolean;
  razorpayConfigured: boolean;
}) {
  const [provider, setProvider] = useState(currentProvider);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(value: BillingProvider) {
    if (value === provider || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setBillingProviderAction(value);
      if (result.success) {
        setProvider(value);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const configured = opt.value === "stripe" ? stripeConfigured : razorpayConfigured;
          const isSelected = opt.value === provider;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => choose(opt.value)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-luxury duration-300 disabled:cursor-wait ${
                isSelected ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10 hover:border-gold-500/40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isSelected ? "border-gold-500 bg-gold-500 text-navy-950" : "border-navy-950/20"
                }`}
              >
                {isSelected && (pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />)}
              </span>
              <span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-navy-950">{opt.label}</span>
                  {!configured ? (
                    <span className="rounded-full bg-navy-950/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-navy-700/50">
                      Not configured
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-navy-700/60">{opt.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-navy-700/50">
        Switching here doesn&rsquo;t affect payments already made — only which processor new
        checkouts on <code className="rounded bg-navy-950/5 px-1 py-0.5">/start</code> use going forward.
      </p>
    </div>
  );
}
