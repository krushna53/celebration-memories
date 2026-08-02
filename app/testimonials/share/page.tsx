import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { ShareExperienceForm } from "@/features/testimonials/share-experience-form";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: "Share Your Experience — EveryMoment",
  description: "Tell us about your event site and rate your experience — your story may be featured on the homepage.",
};

export default function ShareExperiencePage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Tell Us About It"
            title="Share Your Experience"
            description="A star rating and a few words about your event site — we review every story before it goes on the homepage."
          />
          <div className="mt-12">
            <Reveal>
              <ShareExperienceForm />
            </Reveal>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
