import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { listCategoryTree } from "@/services/marketplace-categories";
import { getSuggestedCategoriesForEventType } from "@/services/marketplace-suggestions";
import { SITE_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Discover Event Vendors — Photographers, Venues, Makeup Artists & More | ${SITE_NAME}`,
  description:
    "Browse photographers, videographers, venues, makeup artists, and entertainers for your next celebration. Real profiles and pricing — contact vendors directly, no commission.",
  openGraph: {
    title: `Discover Event Vendors | ${SITE_NAME}`,
    description: "Browse and compare event vendors for your next celebration.",
    type: "website",
  },
};

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "anniversary", label: "Anniversary" },
  { value: "retirement", label: "Retirement" },
  { value: "baby_shower", label: "Baby Shower" },
  { value: "corporate", label: "Corporate Event" },
  { value: "workshop", label: "Workshop" },
];

/**
 * Discover hub — the "Discover" top-level nav destination. Browses the
 * full category tree (no nav mega-menu needed — see
 * components/layout/navbar.tsx's doc comment on why that was kept out
 * of scope for this pass) and surfaces the module spec's "AI Features"
 * event-type suggestion widget via a plain GET param, so picking an
 * event type is itself a shareable URL (/discover?eventType=birthday).
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ eventType?: string }>;
}) {
  const { eventType } = await searchParams;
  const [categoryTree, suggestions] = await Promise.all([
    listCategoryTree(),
    eventType ? getSuggestedCategoriesForEventType(eventType) : Promise.resolve([]),
  ]);

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-navy-950 pb-20 pt-32 text-ivory-50 sm:pt-40">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.35em] text-gold-300">Discover</p>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl">Find Everything For Your Event</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ivory-100/75">
            Photographers, venues, and entertainers — verified vendors, right inside EveryMoment.
          </p>
        </div>
      </div>

      <div className="bg-ivory-50 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal>
            <div className="rounded-2xl border border-gold-500/20 bg-white p-6 text-center shadow-sm">
              <p className="font-display text-lg text-navy-950">Planning an event? Tell us what kind.</p>
              <p className="mt-1 text-sm text-navy-700/60">We&rsquo;ll suggest the vendor categories that matter most.</p>
              <form method="get" className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <Link
                    key={opt.value}
                    href={`/discover?eventType=${opt.value}`}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-luxury duration-200 ${
                      eventType === opt.value
                        ? "border-gold-500 bg-gold-500/10 text-navy-950"
                        : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </form>

              {eventType && suggestions.length > 0 ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-navy-950/10 pt-6">
                  <span className="text-xs uppercase tracking-wide text-navy-700/50">You&rsquo;ll probably need:</span>
                  {suggestions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/${s.slug}`}
                      className="rounded-full bg-gold-500/10 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-500/20"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              ) : eventType ? (
                <p className="mt-6 border-t border-navy-950/10 pt-6 text-sm text-navy-700/50">
                  No suggestions configured yet for this event type.
                </p>
              ) : null}
            </div>
          </Reveal>
        </div>
      </div>

      <div className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Browse" title="Every Category" description="Tap a category to see verified listings near you." />
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {categoryTree.map((top) => (
              <Reveal key={top.id}>
                <div>
                  <Link href={`/${top.slug}`} className="font-display text-lg text-navy-950 hover:text-gold-600">
                    {top.name}
                  </Link>
                  <ul className="mt-2 grid gap-1.5">
                    {top.children.slice(0, 6).map((sub) => (
                      <li key={sub.id}>
                        <Link href={`/${sub.slug}`} className="text-sm text-navy-700/70 hover:text-gold-600">
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-navy-950 py-16 text-center text-ivory-50 sm:py-20">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl">Run a photography studio, venue, or act?</h2>
            <p className="mt-4 text-sm text-ivory-100/75 sm:text-base">
              List your business on EveryMoment and get discovered by hosts planning their next event.
            </p>
            <Button size="lg" className="mt-7" asChild>
              <Link href="/business">Become a Partner</Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
