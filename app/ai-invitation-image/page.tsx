import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { PublicAiImageTool } from "@/features/public-ai-image/public-ai-image-tool";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Free AI Invitation Image Generator | ${SITE_NAME}`,
  description:
    "Describe your event and get a free AI-generated invitation image in seconds — no account needed. Like what you see? Build your full event site free.",
  openGraph: {
    title: `Free AI Invitation Image Generator | ${SITE_NAME}`,
    description: "Describe your event and get a free AI-generated invitation image in seconds — no account needed.",
    type: "website",
  },
};

/**
 * Standalone public quick AI invitation-image tool (#81) — a no-
 * account, no-event marketing/lead-gen page showcasing the AI Image
 * feature that otherwise only lives behind the admin dashboard/wizard.
 * The form itself (features/public-ai-image/public-ai-image-tool.tsx)
 * posts to app/api/public-ai-image/route.ts, which is the real
 * enforcement point for the per-IP/global daily rate limit — see that
 * route's header comment for the full reasoning on why an
 * unauthenticated, pay-per-call endpoint needs its own dedicated
 * rate-limit table rather than the admin flow's per-event quota.
 */
export default function PublicAiImagePage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-navy-950 pb-16 pt-32 text-ivory-50 sm:pt-40">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.35em] text-gold-300">Free Tool</p>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl">AI Invitation Image Generator</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ivory-100/75">
            Describe your event and get a free, AI-generated invitation image in seconds. No account, no payment —
            just try it.
          </p>
        </div>
      </div>

      <div className="bg-ivory-50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHeading eyebrow="Try It Now" title="Generate Your Invitation Image" description="A few free tries per day." />
          <div className="mt-10">
            <PublicAiImageTool />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
