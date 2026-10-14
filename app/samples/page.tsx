import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { StartBuildingButton } from "@/features/start/start-building-button";
import { SampleEventsGrid } from "@/features/platform/sample-events-grid";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { SITE_URL } from "@/lib/constants";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sample Events — See What You Can Build | EveryMoment",
  description:
    "Explore live sample event pages — a birthday, a college reunion and a workshop — with invites, RSVP, schedules and photo sharing. Then create your own, free.",
  alternates: { canonical: `${SITE_URL}/samples` },
};

/** Public showcase of the sample events (events.is_demo) — the link to share for people to try EveryMoment. */
export default function SamplesPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">See it live</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">Sample event pages</h1>
            <p className="mt-5 text-navy-700">
              These are real, working pages — open one on your phone, RSVP, look at the schedule and the photo wall. Then
              build your own in a few minutes.
            </p>
          </div>
          <div className="mt-12">
            <SampleEventsGrid />
          </div>
          <div className="mt-14 rounded-3xl bg-navy-950 px-6 py-10 text-center text-ivory-50 sm:px-10">
            <h2 className="font-display text-2xl sm:text-3xl">Ready to create yours?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ivory-100/75">
              Free to try. No account needed until you&rsquo;re happy with how it looks.
            </p>
            <div className="mt-6 flex justify-center">
              <StartBuildingButton size="lg">Create your event — free</StartBuildingButton>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
