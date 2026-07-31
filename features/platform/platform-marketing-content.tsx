import Link from "next/link";
import {
  CalendarClock,
  Camera,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { BUILDER, SUPPORT } from "@/lib/constants";

const LIVE_FEATURES = [
  {
    icon: Link2,
    title: "Unique guest links",
    description:
      "Every invitee gets a private link that auto-identifies them, tracks opens and visits, and takes them straight to RSVP — no login, ever.",
  },
  {
    icon: Camera,
    title: "Guest photos, video & voice",
    description:
      "Guests upload or record memories right from their phone browser. Everything sits in a moderation queue until you approve it.",
  },
  {
    icon: LayoutDashboard,
    title: "Full admin dashboard",
    description:
      "RSVP breakdown, upload counts, most active guests, invitee management with CSV import, and one-tap WhatsApp sending.",
  },
  {
    icon: CalendarClock,
    title: "Edit everything yourself",
    description:
      "Event details, gallery, and timeline are all editable from the dashboard — changes go live on the site within a minute.",
  },
  {
    icon: MessageCircle,
    title: "Built for WhatsApp",
    description:
      "Generate pre-filled WhatsApp invite messages per guest, and every page has native share buttons for WhatsApp, email, and more.",
  },
  {
    icon: ShieldCheck,
    title: "Public or private",
    description:
      "List your event in the public directory for open celebrations, or keep it link-only and share it exactly how you choose.",
  },
  {
    icon: Palette,
    title: "10 ready-made templates",
    description:
      "Royal Gold, Floral Pastel, Minimal White, Kids Cartoon, Neon Party, Golden Confetti, Balloon Pop, Milestone Elegant, Retro Disco, and Vintage Keepsake — plus community-submitted templates.",
  },
  {
    icon: Sparkles,
    title: "AI image generation",
    description:
      "Describe the invitation image you want in a sentence and generate it right from the dashboard — available to every event.",
  },
];

/**
 * Shared nav for every platform-level (non-event) page — Pricing,
 * Roles, Events directory, Template submission, Contact, Privacy, and
 * the Visitor Guide. These pages have no #hero/#details/... sections,
 * so they must never fall back to Navbar's default event-page anchors
 * (see components/layout/navbar.tsx's NAV_LINKS) — that mismatch used
 * to leave every platform page's header pointing at anchors that don't
 * exist on it.
 */
export const PLATFORM_NAV_LINKS = [
  { label: "Browse Events", href: "/events" },
  { label: "Pricing", href: "/pricing" },
  { label: "Templates", href: "/templates/submit" },
  { label: "Who Can Do What", href: "/roles" },
  { label: "Contact", href: "/contact" },
] as const;

/**
 * The platform's own marketing/info content — not tied to any one
 * event. Rendered as the site root (app/page.tsx) now that the platform
 * is positioned for multiple clients rather than one event; the
 * original single-event experience lives at /events/[slug] same as
 * every other event. /platform still resolves (redirects here) so old
 * links keep working.
 */
export function PlatformMarketingContent() {
  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} showLogin transparentUntilScroll>
      <div className="bg-navy-950 pb-24 pt-32 text-ivory-50 sm:pt-40">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-300">
              A Krushna Web Works Product
            </p>
            <h1 className="mt-5 font-display text-4xl sm:text-5xl">
              Celebration Memories
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ivory-100/75 sm:text-lg">
              A premium, mobile-first invitation site for the moments worth
              gathering for — birthdays, weddings, anniversaries, retirements,
              baby showers, memorials, workshops, and more. Unique guest
              links, live RSVP tracking, and a shared wall of photos, videos,
              and messages from everyone who came.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/start">Build Your Event Site — Free to Try</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-gold-400/60 text-gold-200 hover:bg-gold-400/10">
                <Link href="/events">Browse Public Events</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-ivory-100/60">
              Curious what a guest, host, or admin can each do?{" "}
              <Link href="/roles" className="text-gold-300 underline underline-offset-2 hover:text-gold-200">
                See who can do what
              </Link>
              {" · "}
              <Link href="/events" className="text-gold-300 underline underline-offset-2 hover:text-gold-200">
                Browse live events
              </Link>
            </p>
          </Reveal>
        </div>
      </div>

      <div className="bg-ivory-50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Live Today"
            title="Everything You Need To Host, Digitally"
            description="Every event on the platform gets the same premium foundation — this is what's already working."
          />
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE_FEATURES.map((feature) => (
              <Reveal key={feature.title}>
                <div className="h-full rounded-2xl border border-navy-950/10 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                    <feature.icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-lg text-navy-950">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-700/75">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-navy-950 py-20 text-center text-ivory-50 sm:py-24">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl">
              Want a site like this for your event?
            </h2>
            <p className="mt-4 text-sm text-ivory-100/75 sm:text-base">
              Message {BUILDER.name} on WhatsApp and we&rsquo;ll set one up for you.
            </p>
            <Button size="lg" className="mt-7" asChild>
              <a href={BUILDER.whatsappUrl} target="_blank" rel="noopener noreferrer">
                Start On WhatsApp
              </a>
            </Button>
            <p className="mt-8 text-xs text-ivory-100/60">
              Like this platform and want to help it grow?{" "}
              <a
                href={SUPPORT.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-300 underline underline-offset-2 hover:text-gold-200"
              >
                Support / Contribute
              </a>
            </p>
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
