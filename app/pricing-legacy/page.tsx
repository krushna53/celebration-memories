import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { PricingPlans } from "@/features/pricing/pricing-plans";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: "Pricing (Legacy) — EveryMoment",
  robots: { index: false, follow: false },
  description:
    "Free, Premium, and Pro plans for your celebration site — unique guest links, RSVP tracking, guest photo/video uploads, AI invitation images, and more.",
};

/**
 * The original general-audience pricing page (Free/Premium/Pro), kept
 * fully intact and reachable by direct link, but deliberately not
 * linked from anywhere (header, footer, or /pricing itself — that route
 * now serves the photographer-focused page instead, see
 * app/pricing/page.tsx). Nothing about the underlying wizard/checkout
 * flow changed: PricingPlans and beginDraftWithPlanAction are the exact
 * same components the live page used, just parked at a URL a visitor
 * won't stumble onto. noindex'd so it doesn't show up in search either.
 */
export default function PricingLegacyPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="A Plan For Every Celebration"
            description="Start free, upgrade whenever you need more — no login required to try it, and payment is the very last step, after you've already seen your finished site."
          />
          <div className="mt-14">
            <PricingPlans />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
