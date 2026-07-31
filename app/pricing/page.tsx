import type { Metadata } from "next";
import { Camera, FileImage, Images, QrCode, Sparkles, UserCheck } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { PhotographerPricingPlans } from "@/features/pricing/photographer-pricing-plans";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: "Pricing for Photographers & Studios — Celebration Memories",
  description:
    "Deliver a full event website, guest gallery, RSVP, and AI slideshow for every client shoot — not just a photo download link. Plans for solo photographers up to full studios and agencies.",
};

const PHOTOGRAPHER_HIGHLIGHTS = [
  { icon: Camera, label: "AI event website for every shoot" },
  { icon: Images, label: "Client galleries with QR sharing" },
  { icon: UserCheck, label: "Client photo selection & approval" },
  { icon: Sparkles, label: "AI invitation images & slideshow video" },
  { icon: FileImage, label: "Album management, delivery-ready" },
  { icon: QrCode, label: "One link — no app or login for clients" },
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
export default function PricingPage() {
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
            <PhotographerPricingPlans />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
