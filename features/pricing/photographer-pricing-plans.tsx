"use client";

import { useState } from "react";
import { Check, Loader2, MessageCircle, Sparkles, Ticket } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { beginDraftWithPlanAction } from "@/features/pricing/actions";
import type { Currency } from "@/features/pricing/currency";
import type { PricingPlanId, PricingPlanSetting } from "@/services/pricing-settings";

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
  /** Sent as a hidden form field and looked up via getPlanAiLimits (services/pricing-settings.ts) in features/pricing/actions.ts — the one real, enforced lever behind these tiers today, and itself owner-editable at /admin/pricing-settings. Omitted for the contact-only tier. */
  planId?: string;
  /** Carried straight into the wizard's Payment step via a cookie — see features/pricing/actions.ts. */
  promoCode?: string;
  /** True for the tier with no self-serve checkout — routes to a WhatsApp inquiry instead of the wizard. */
  contactOnly?: boolean;
  highlight?: boolean;
  features: string[];
}

/**
 * Only three tiers, and every feature line below is something that
 * actually exists and is actually enforced in the product today — see
 * lib/admin-roles.ts's CLIENT_ALLOWED_PATHS for what a paying customer
 * (client-role admin) can access, and features/admin/ai-image/actions.ts
 * + features/admin/slideshow/actions.ts for the one real usage cap
 * (AI credits). Earlier drafts of this page differentiated tiers by
 * "number of active events," team members, white-labeling, and a
 * client photo-approval workflow — none of that exists (there's no
 * multi-event-per-account system, /admin/members and /admin/referrals
 * are owner-only, footer.tsx has no branding toggle, and there's no
 * proofing/approval feature), so those claims were removed rather than
 * built out. What genuinely differs between Free and Pro is AI credits;
 * Studio/Agency is intentionally a "let's talk" tier for anything
 * beyond that, since there's no self-serve infrastructure to back a
 * higher automated tier yet.
 *
 * Free and Pro's actual monthly/annual numbers are NOT hardcoded here
 * — they come from services/pricing-settings.ts (owner-editable at
 * /admin/pricing-settings) and are merged in by buildTiers() below, so
 * the platform owner can change them without a code deploy.
 */
function buildTiers(planPrices: Record<PricingPlanId, PricingPlanSetting>): Tier[] {
  return [
    {
      id: "free",
      name: "Free",
      tagline: "Try it with your next client shoot",
      monthly: { usd: planPrices.free.monthlyUsd, inr: planPrices.free.monthlyInr },
      annual: { usd: planPrices.free.annualUsd, inr: planPrices.free.annualInr },
      cta: "Start Free",
      planId: "free",
      promoCode: "FREE",
      features: [
        "Full event website (invitation, countdown, event details)",
        "Any of the 10+ ready-made templates",
        "RSVP tracking with per-guest links (no login for guests)",
        "Guest photo, video & voice uploads, with a moderation queue",
        "Gallery, Timeline, and Guest Memories wall",
        "Built-in event planner — to-dos & notes, shareable with family (no separate logins)",
        "Digital party games — Word Search, Housie, and Movie Name Housie with QR guest access",
        "Invitee management with CSV import & one-tap WhatsApp sending",
        `AI invitation image — ${planPrices.free.aiImageGenerationLimit} generations`,
        `AI slideshow video — ${planPrices.free.slideshowVideoGenerationLimit} generations`,
      ],
    },
    {
      id: "pro",
      name: "Pro",
      tagline: "For working photographers & regular hosts",
      monthly: { usd: planPrices.pro.monthlyUsd, inr: planPrices.pro.monthlyInr },
      annual: { usd: planPrices.pro.annualUsd, inr: planPrices.pro.annualInr },
      cta: "Get Pro",
      planId: "pro",
      highlight: true,
      features: [
        "Everything in Free, plus:",
        `AI invitation image — ${planPrices.pro.aiImageGenerationLimit} generations`,
        `AI slideshow video — ${planPrices.pro.slideshowVideoGenerationLimit} generations`,
        "Dashboard analytics: RSVP breakdown, upload counts, most active guests",
        "Priority email support",
      ],
    },
    {
      id: "studio",
      name: "Studio & Agency",
      tagline: "Running several events or shoots regularly? Let's talk",
      monthly: null,
      annual: null,
      cta: "Contact Us",
      contactOnly: true,
      features: [
        "Everything in Pro, plus:",
        "Higher AI credit allowances, sized to your volume",
        "Help setting up multiple events",
        "Direct WhatsApp support line",
      ],
    },
  ];
}

const STUDIO_WHATSAPP_URL =
  "https://wa.me/919987982969?text=Hi%20Harshal%2C%20I%27d%20like%20to%20talk%20about%20a%20Studio%2FAgency%20plan.";

function formatPrice(price: Price, currency: Currency): string {
  if (currency === "INR") {
    return price.inr === 0 ? "₹0" : `₹${price.inr.toLocaleString("en-IN")}`;
  }
  return price.usd === 0 ? "$0" : `$${price.usd.toLocaleString("en-US")}`;
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

export function PhotographerPricingPlans({
  initialCurrency,
  planPrices,
}: {
  initialCurrency: Currency;
  planPrices: Record<PricingPlanId, PricingPlanSetting>;
}) {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [promoCode, setPromoCode] = useState("");
  const tiers = buildTiers(planPrices);

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

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <div className="flex items-center gap-2">
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

        <div className="hidden h-5 w-px bg-navy-950/10 sm:block" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-luxury duration-200",
              currency === "USD" ? "bg-navy-950 text-ivory-50" : "text-navy-700/60 hover:text-navy-950",
            )}
          >
            USD ($)
          </button>
          <button
            type="button"
            onClick={() => setCurrency("INR")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-luxury duration-200",
              currency === "INR" ? "bg-navy-950 text-ivory-50" : "text-navy-700/60 hover:text-navy-950",
            )}
          >
            INR (₹)
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-navy-700/45">
        {currency === "INR" ? "Showing Indian pricing based on your location." : "Showing US-dollar pricing based on your location."}{" "}
        Switch anytime above.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const price = tier.monthly && tier.annual ? (period === "monthly" ? tier.monthly : tier.annual) : null;
          const savings =
            tier.monthly && tier.annual
              ? annualSavingsPercent(
                  currency === "INR" ? tier.monthly.inr : tier.monthly.usd,
                  currency === "INR" ? tier.annual.inr : tier.annual.usd,
                )
              : null;

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

              <div className="mt-5 min-h-[56px]">
                {price ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-3xl text-navy-950">{formatPrice(price, currency)}</span>
                      <span className="text-sm text-navy-700/50">/ {period === "monthly" ? "mo" : "yr"}</span>
                    </div>
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
                  href={STUDIO_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy-950 px-4 py-2.5 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:bg-navy-900"
                >
                  <MessageCircle size={16} /> {tier.cta}
                </a>
              ) : (
                <form action={beginDraftWithPlanAction} className="mt-6">
                  {tier.promoCode ? <input type="hidden" name="promoCode" value={tier.promoCode} /> : null}
                  {tier.planId ? <input type="hidden" name="planId" value={tier.planId} /> : null}
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
        Prices shown are suggested list pricing. The exact amount charged at checkout is configured by the platform
        owner and may differ; if card checkout isn&rsquo;t set up yet, you&rsquo;ll be offered a QR/UPI payment option
        instead at the final step. Studio &amp; Agency pricing is custom — reach out and we&rsquo;ll scope it to you.
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
