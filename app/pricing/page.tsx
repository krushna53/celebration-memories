import type { Metadata } from "next";
import { Camera, ImageIcon, MessagesSquare, Sparkles, Link2, BarChart3 } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { PhotographerPricingPlans } from "@/features/pricing/photographer-pricing-plans";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { getDetectedCurrency } from "@/features/pricing/currency";
import { getPricingPlanSettings } from "@/services/pricing-settings";

export const metadata: Metadata = {
  title: "Pricing for Photographers & Studios — Celebration Memories",
  description:
    "Deliver a full event website, guest gallery, RSVP, and AI slideshow for every client shoot — not just a photo download link. Plans for solo photographers up to full studios and agencies.",
};

/**
 * Every highlight here maps to a real, shipped feature — see the audit
 * notes in features/pricing/photographer-pricing-plans.tsx for what was
 * removed (QR sharing, client photo approval, album/delivery management
 * all don't exist yet) and why.
 */
const PHOTOGRAPHER_HIGHLIGHTS = [
  { icon: Camera, label: "Full event website for every shoot" },
  { icon: Link2, label: "One link — no app or login for guests" },
  { icon: ImageIcon, label: "Gallery, Timeline & Guest Memories wall" },
  { icon: Sparkles, label: "AI invitation images & slideshow video" },
  { icon: MessagesSquare, label: "Guest photo/video/voice uploads, moderated" },
  { icon: BarChart3, label: "RSVP & analytics dashboard" },
];

/**
 * Photographer/studio-focused pricing — replaces the general-audience
 * Free/Premium/Pro page that used to live at this URL (still fully
 * functional, just moved to /pricing-legacy and unlinked — see that
 * route's file comment). Tiers and feature framing are pulled from the
 * platform's Photographer Platform positioning: a photographer manages
 * many client events, not just one celebration, so pricing scales by
 * active events + AI credits rather than a single flat plan.
 */
export default async function PricingPage() {
  const [initialCurrency, planPrices] = await Promise.all([getDetectedCurrency(), getPricingPlanSettings()]);

  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Pricing for Photographers & Studios"
            title="Deliver More Than a Gallery Link"
            description="Every client shoot becomes a full event website — invitation, RSVP, guest uploads, and an AI slideshow — not just a folder of downloads. Start free, upgrade as your studio grows."
          />

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
            {PHOTOGRAPHER_HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-xl border border-navy-950/10 bg-white px-4 py-3"
              >
                <Icon size={16} className="shrink-0 text-gold-600" />
                <span className="text-xs font-medium text-navy-700">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <PhotographerPricingPlans initialCurrency={initialCurrency} planPrices={planPrices} />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
