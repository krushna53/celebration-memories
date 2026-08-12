import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { NewFormWizard } from "@/features/forms/new-form-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Entry point for "Build RSVP / Form" (global nav link) — a short wizard
 * (features/forms/new-form-wizard.tsx) that asks what kind of RSVP
 * this is and how to build it, before creating the draft form and
 * handing off to /forms/build/[token]. No login required at any step
 * — same draft_token trust model as the builder itself.
 *
 * Wrapped in the same SiteShell (fixed nav + footer) every other
 * platform tool page uses (app/templates/submit/page.tsx,
 * app/discover/page.tsx, etc.) — all 3 wizard steps live inside
 * NewFormWizard's own client-side state on this one page, so wrapping
 * here covers every step without needing it in three places.
 */
export default function NewFormPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="min-h-screen bg-ivory-100 pb-16 pt-28 sm:pt-32">
        <NewFormWizard />
      </div>
    </SiteShell>
  );
}
