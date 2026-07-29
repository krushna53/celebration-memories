"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, Ticket } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { beginDraftWithPlanAction } from "@/features/pricing/actions";

interface Price {
  usd: number;
  inr: number;
}

interface Tier {
  id: string;
  name: string;
  tagline: string;
  monthly: Price;
  annual: Price;
  cta: string;
  /** Carried straight into the wizard's Payment step via a cookie — see features/pricing/actions.ts. */
  promoCode?: string;
  highlight?: boolean;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try the whole builder, no card needed",
    monthly: { usd: 0, inr: 0 },
    annual: { usd: 0, inr: 0 },
    cta: "Start Free",
    promoCode: "FREE",
    features: [
      "1 celebration site",
      "Up to 75 guests",
      "3 standard templates",
      "Guest photo uploads (up to 50 photos)",
      "Basic RSVP tracking",
      "Shareable WhatsApp invite link",
      "“Powered by Celebration Memories” footer",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "A fully polished site for one celebration",
    monthly: { usd: 19, inr: 599 },
    annual: { usd: 149, inr: 4999 },
    cta: "Get Premium",
    highlight: true,
    features: [
      "Everything in Free, plus:",
      "Unlimited guests",
      "All premium & community templates",
      "Unlimited guest photo, video & voice uploads",
      "AI-generated invitation image (10 / month)",
      "Guest check-in on event day",
      "Custom domain request",
      "Branding removed",
      "Priority email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For planners, venues & multi-event hosts",
    monthly: { usd: 49, inr: 1499 },
    annual: { usd: 399, inr: 11999 },
    cta: "Get Pro",
    features: [
      "Everything in Premium, plus:",
      "Up to 10 event sites",
      "AI slideshow video generator",
      "Big Screen Display mode",
      "Advanced analytics & most-active-guest insights",
      "CSV bulk invitee import",
      "Fully white-labeled, no branding anywhere",
      "Dedicated WhatsApp support",
    ],
  },
];

function formatUsd(n: number): string {
  return n === 0 ? "$0" : `$${n.toLocaleString("en-US")}`;
}

function formatInr(n: number): string {
  return n === 0 ? "₹0" : `₹${n.toLocaleString("en-IN")}`;
}

function annualSavingsPercent(monthly: number, annual: number): number | null {
  if (monthly <= 0 || annual <= 0) return null;
  const fullYear = monthly * 12;
  if (annual >= fullYear) return null;
  return Math.round(((fullYear - annual) / fullYear) * 100);
}

function StartButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" size={16} /> : label}
    </Button>
  );
}

export function PricingPlans() {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [promoCode, setPromoCode] = useState("");

  return (
    <div>
      {/* Promo code callout — placed above the tier cards per spec: type
          a code (e.g. FREE) and start the builder with it already
          applied at the wizard's final Payment step, no charge. */}
      <form
        action={beginDraftWithPlanAction}
        className="mx-auto mb-12 flex max-w-md flex-col items-stretch gap-3 rounded-2xl border border-gold-500/25 bg-gold-500/5 px-5 py-5 text-center sm:flex-row sm:items-center sm:text-left"
      >
        <div className="flex flex-1 items-center gap-2">
          <Ticket size={18} className="shrink-0 text-gold-600" />
          <input
            name="promoCode"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Have a promo code? Enter it here (try FREE)"
            className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm uppercase text-navy-950 placeholder:text-navy-700/40 placeholder:normal-case focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
        </div>
        <SubmitPromoButton disabled={!promoCode.trim()} />
      </form>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPeriod("monthly")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-luxury duration-200",
            period === "monthly" ? "bg-navy-950 text-ivory-50" : "text-navy-700/60 hover:text-navy-950",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setPeriod("annual")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-luxury duration-200",
            period === "annual" ? "bg-navy-950 text-ivory-50" : "text-navy-700/60 hover:text-navy-950",
          )}
        >
          Annual
          <span className="rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
            Save
          </span>
        </button>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const price = period === "monthly" ? tier.monthly : tier.annual;
          const savings = annualSavingsPercent(tier.monthly.usd, tier.annual.usd);

          return (
            <div
              key={tier.id}
              className={cn(
                "flex flex-col rounded-2xl border bg-white p-6 sm:p-7",
                tier.highlight ? "border-gold-500 shadow-lg ring-1 ring-gold-500/30" : "border-navy-950/10",
              )}
            >
              {tier.highlight ? (
                <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy-950">
                  <Sparkles size={11} /> Most Popular
                </span>
              ) : null}

              <h3 className="font-display text-xl text-navy-950">{tier.name}</h3>
              <p className="mt-1 text-sm text-navy-700/60">{tier.tagline}</p>

              <div className="mt-5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl text-navy-950">{formatUsd(price.usd)}</span>
                  <span className="text-sm text-navy-700/50">/ {period === "monthly" ? "mo" : "yr"}</span>
                </div>
                <p className="mt-0.5 text-sm text-navy-700/60">
                  or {formatInr(price.inr)} / {period === "monthly" ? "mo" : "yr"}
                </p>
                {period === "annual" && savings ? (
                  <p className="mt-1 text-xs font-medium text-gold-700">Save ~{savings}% vs. monthly</p>
                ) : null}
              </div>

              <form action={beginDraftWithPlanAction} className="mt-6">
                {tier.promoCode ? <input type="hidden" name="promoCode" value={tier.promoCode} /> : null}
                <StartButton label={tier.cta} />
              </form>

              <ul className="mt-6 grid gap-2.5 text-sm text-navy-700/80">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-gold-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-navy-700/50">
        Prices shown are suggested list pricing in USD and INR. The exact amount charged at checkout is configured by
        the site owner and may differ; if card checkout isn&rsquo;t set up yet, you&rsquo;ll be offered a QR/UPI
        payment option instead at the final step.
      </p>
    </div>
  );
}

function SubmitPromoButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="shrink-0">
      {pending ? <Loader2 className="animate-spin" size={16} /> : "Apply & Start"}
    </Button>
  );
}
