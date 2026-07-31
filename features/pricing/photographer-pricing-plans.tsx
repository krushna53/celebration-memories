"use client";

import { useState } from "react";
import { Check, Loader2, MessageCircle, Sparkles, Ticket } from "lucide-react";
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
  monthly: Price | null;
  annual: Price | null;
  cta: string;
  /** Carried straight into the wizard's Payment step via a cookie — see features/pricing/actions.ts. Not used by the "Contact Us" (custom-priced) tier. */
  promoCode?: string;
  /** True for the one tier with no self-serve checkout — routes to a WhatsApp inquiry instead of the wizard. */
  contactOnly?: boolean;
  highlight?: boolean;
  features: string[];
}

/**
 * Pricing benchmarked against the main photographer client-gallery
 * tools (Pixieset, ShootProof, Pic-Time — all roughly Free / $8-10 /
 * $20-25 / $50 tiers, scaled by storage). Ours scales by active
 * events + AI credits instead of raw storage, matching this platform's
 * actual differentiators (AI invitation images, AI slideshow video,
 * full event websites, not just galleries).
 */
const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try it with your next client shoot",
    monthly: { usd: 0, inr: 0 },
    annual: { usd: 0, inr: 0 },
    cta: "Start Free",
    promoCode: "FREE",
    features: [
      "1 active event/gallery",
      "Up to 100 guest photo/video uploads",
      "3 standard templates",
      "Basic RSVP & guest management",
      "Shareable client link (no login for guests)",
      "“Powered by” footer credit",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For photographers just getting started",
    monthly: { usd: 15, inr: 1199 },
    annual: { usd: 129, inr: 9999 },
    cta: "Get Starter",
    features: [
      "Everything in Free, plus:",
      "Up to 3 active events / month",
      "Unlimited guest photo, video & voice uploads",
      "AI invitation image — 10 credits / month",
      "Custom domain connect",
      "Branding removed",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "For working photographers & small studios",
    monthly: { usd: 39, inr: 2999 },
    annual: { usd: 349, inr: 26999 },
    cta: "Get Professional",
    highlight: true,
    features: [
      "Everything in Starter, plus:",
      "Up to 15 active events / month",
      "AI invitation image — 30 credits / month",
      "AI slideshow video generator — 5 / month",
      "Client photo selection & approval workflow",
      "Advanced analytics & most-active-guest insights",
      "Priority email support",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For high-volume studios & event planners",
    monthly: { usd: 89, inr: 6999 },
    annual: { usd: 799, inr: 62999 },
    cta: "Get Studio",
    features: [
      "Everything in Professional, plus:",
      "Unlimited active events",
      "AI credits — unlimited (fair use)",
      "Up to 5 team members",
      "Fully white-labeled, no branding anywhere",
      "Referral rewards program access",
      "Dedicated WhatsApp support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "For agencies & multi-studio operations",
    monthly: null,
    annual: null,
    cta: "Contact Us",
    contactOnly: true,
    features: [
      "Everything in Studio, plus:",
      "Unlimited team members",
      "White-label platform + custom branding",
      "Custom domain for your whole client base",
      "API access",
      "Dedicated account manager",
    ],
  },
];

const AGENCY_WHATSAPP_URL =
  "https://wa.me/919987982969?text=Hi%20Harshal%2C%20I%27d%20like%20to%20talk%20about%20the%20Agency%20plan%20for%20my%20studio.";

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

export function PhotographerPricingPlans() {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [promoCode, setPromoCode] = useState("");

  return (
    <div>
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

      <div className="mt-10 grid gap-6 lg:grid-cols-3 xl:grid-cols-5">
        {TIERS.map((tier) => {
          const price = tier.monthly && tier.annual ? (period === "monthly" ? tier.monthly : tier.annual) : null;
          const savings =
            tier.monthly && tier.annual ? annualSavingsPercent(tier.monthly.usd, tier.annual.usd) : null;

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

              <div className="mt-5 min-h-[64px]">
                {price ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex h-full items-end">
                    <span className="font-display text-2xl text-navy-950">Custom Pricing</span>
                  </div>
                )}
              </div>

              {tier.contactOnly ? (
                <a
                  href={AGENCY_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy-950 px-4 py-2.5 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:bg-navy-900"
                >
                  <MessageCircle size={16} /> {tier.cta}
                </a>
              ) : (
                <form action={beginDraftWithPlanAction} className="mt-6">
                  {tier.promoCode ? <input type="hidden" name="promoCode" value={tier.promoCode} /> : null}
                  <StartButton label={tier.cta} />
                </form>
              )}

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
        the platform owner and may differ; if card checkout isn&rsquo;t set up yet, you&rsquo;ll be offered a QR/UPI
        payment option instead at the final step. Agency pricing is custom — reach out and we&rsquo;ll scope it to
        your studio.
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
