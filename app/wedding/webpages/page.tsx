import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { SHOWCASE_SITES } from "@/features/wedding-showcase/showcase-sites";
import SiteCard from "@/features/wedding-showcase/SiteCard";
import { WeddingTabs } from "@/features/wedding-showcase/WeddingTabs";
import { SITE_URL } from "@/lib/constants";

const COUNT = SHOWCASE_SITES.length;

export const metadata: Metadata = {
  title: `Wedding Website Designs — ${COUNT} Live Samples | EveryMoment`,
  description: `Open ${COUNT} sample wedding websites — ribbon and gatefold envelopes, theatre and fairy-light curtains, temple doors — each with its own page design, countdown, schedule, map and RSVP. Then make it yours.`,
  alternates: { canonical: `${SITE_URL}/wedding/webpages` },
};

// columns per group, so every row is full: 6 envelopes in threes, 8 curtains in fours, 6 doors in threes
const GROUPS = [
  { id: "envelope", title: "Envelope openings", cols: "lg:grid-cols-3" },
  { id: "curtain", title: "Curtain openings", cols: "lg:grid-cols-4" },
  { id: "doors", title: "Door openings", cols: "lg:grid-cols-3" },
  { id: "none", title: "No opening", cols: "" },
];

/** Showcase of the sample wedding websites (fictional couples), for visitors and the wedding exhibition. */
export default function WeddingWebpagesPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Wedding websites</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">{COUNT} designs to explore</h1>
            <p className="mt-5 text-navy-700">
              Every one is a real, working website with its own opening and its own page design. Hover a card to play the
              opening, open it to scroll the countdown, schedule, map and RSVP — then tap “Create your own” to make it
              yours. All names and venues are samples.
            </p>
          </div>
          <WeddingTabs active="webpages" />

          {GROUPS.map((group) => {
            const sites = SHOWCASE_SITES.filter((s) => s.group === group.id);
            if (!sites.length) return null;
            return (
              <section key={group.id} className="mt-14" aria-labelledby={`g-${group.id}`}>
                <h2 id={`g-${group.id}`} className="font-display text-2xl text-navy-950">
                  {group.title} <span className="text-base text-navy-700/60">({sites.length})</span>
                </h2>
                <div className={`mt-6 grid gap-6 sm:grid-cols-2 ${group.cols}`}>
                  {sites.map((site) => (
                    <SiteCard key={site.slug} site={site} n={SHOWCASE_SITES.indexOf(site) + 1} wide={group.id === "none"} />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="mt-16 rounded-3xl bg-navy-950 px-6 py-10 text-center text-ivory-50 sm:px-10">
            <h2 className="font-display text-2xl sm:text-3xl">Like one? Make it yours.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ivory-100/75">
              Open any design and tap “Create your own” — it opens in the editor with that design, ready for your names,
              photos, schedule and venue.
            </p>
            <Link
              href="/wedding-websites/create"
              className="mt-6 inline-flex rounded-full bg-gold-500 px-7 py-3 font-semibold text-navy-950 transition hover:bg-gold-400"
            >
              Start from a blank design
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
