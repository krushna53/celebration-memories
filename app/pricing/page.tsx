import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { EventPricingPlans } from "@/features/pricing/event-pricing-plans";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: "Pricing — Per Event & Monthly Plans | EveryMoment",
  description: "Choose Free, Celebration or Studio. Pay once for one event with 12 months of access, or subscribe monthly. Compare prices in INR and USD.",
};

export default function PricingPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Simple pricing</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">One occasion or many. Your choice.</h1>
            <p className="mt-5 text-navy-700">Pay once for a single event, or subscribe when you host regularly. Prices shown in Indian rupees and US dollars.</p>
          </div>
          <div className="mt-10"><EventPricingPlans /></div>
        </div>
      </div>
    </SiteShell>
  );
}
