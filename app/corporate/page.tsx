import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Gamepad2,
  Images,
  Layers,
  Send,
  type LucideIcon,
} from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { beginDraftAction } from "@/features/start/actions/begin";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { SEGMENT_OCCASIONS } from "@/lib/event-segment";

/** Click-to-chat for organisers — same number as BUILDER, organiser-specific opener. */
const ORGANISER_WHATSAPP_URL =
  "https://wa.me/919987982969?text=" +
  encodeURIComponent("Hi, I organise events and would like a 30-minute EveryMoment demo.");

/** Prices mirror features/pricing/event-pricing-plans.tsx — keep the two in step. */
const PARTNER_OPTIONS: { title: string; price: string; body: string; href: string; cta: string; highlight?: boolean }[] = [
  {
    title: "Corporate Event",
    price: "₹4,999 per event",
    body: "One event for 12 months: 2,000 attendees, check-in desk, event report, 20 team members and your branding.",
    href: "/account/billing?plan=corporate",
    cta: "Buy for one event",
  },
  {
    title: "Organiser plans",
    price: "From ₹1,999 / month",
    body: "Run 5 or 20 events at once with your logo on every event and logins for the people you organise for.",
    href: "/pricing#organisers",
    cta: "Compare organiser plans",
    highlight: true,
  },
  {
    title: "White-label",
    price: "From ₹1,50,000 / year",
    body: "Your brand only — EveryMoment branding removed, your own domain and custom limits, bundled into your packages.",
    href: ORGANISER_WHATSAPP_URL,
    cta: "Talk to us",
  },
];

const PILOT_STEPS = [
  "A 30-minute live demo",
  "Pick one of your upcoming events",
  "We set it up together with you",
  "Review the event report with your client",
];

export const metadata: Metadata = {
  title: "Corporate Event Websites, RSVP & Check-In | EveryMoment",
  description:
    "Personal invite links, RSVP tracking, desk check-in, team games, a moderated event wall and a post-event report — for conferences, offsites, annual days and launches.",
};

const STAGES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Send,
    title: "Invite",
    body: "A branded event site and a personal link for every attendee. Import a CSV, send over WhatsApp, and see who opened and who RSVP'd.",
  },
  {
    icon: CheckCircle2,
    title: "Check in",
    body: "Search a name, tap to check in, undo if needed — with live attendance as people arrive.",
  },
  {
    icon: CalendarClock,
    title: "Run the day",
    body: "A time-blocked agenda and menu page on every phone, open to all or verified against the attendee list.",
  },
  {
    icon: Gamepad2,
    title: "Engage",
    body: "Housie and Word Search on attendees' own phones, plus an event wall and a big-screen slideshow.",
  },
  {
    icon: Clapperboard,
    title: "Recap",
    body: "Opt-in personal video reels, a slideshow video and a one-click export of every approved photo and video.",
  },
  {
    icon: BarChart3,
    title: "Report",
    body: "A one-page report — opens, RSVP rate, attendance, uploads, most active attendees — to send to your client.",
  },
];

/**
 * Marketing entry point for corporate hosts and event organisers. Same
 * platform and wizard as family events — the CTA just starts the draft
 * in the corporate segment (lib/event-segment.ts).
 */
export default function CorporatePage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">For corporate events &amp; event organisers</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">
              Every attendee. Every moment. One link.
            </h1>
            <p className="mt-5 text-navy-700">
              Invitations, RSVPs, check-in, engagement and a post-event report for conferences, offsites, annual
              days and launches. Attendees never install an app or create an account.
            </p>
            <form action={beginDraftAction} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <input type="hidden" name="segment" value="corporate" />
              <Button type="submit" size="lg">
                Create a corporate event — free to try
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </form>
          </div>

          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2" aria-label="Event types">
            {SEGMENT_OCCASIONS.corporate.map((o) => (
              <li key={o.id} className="rounded-full border border-navy-950/10 bg-white px-3 py-1 text-xs text-navy-700">
                {o.label}
              </li>
            ))}
          </ul>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-navy-950/10 bg-white p-6 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/15 text-gold-700">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-display text-xl text-navy-950">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/80">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-8 rounded-3xl bg-navy-950 p-8 text-ivory-50 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-300">Built for event organisers</p>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl">Run many client events from one login</h2>
              <p className="mt-4 text-sm leading-relaxed text-ivory-100/75">
                Switch between client events from one dashboard, give each client a login that only sees their own
                event, match their brand with a template and custom styling, and keep AI costs capped per event.
              </p>
            </div>
            <ul className="grid gap-3 text-sm text-ivory-100/85">
              {[
                "Uploads are moderated before anything goes public",
                "Face-matched reels only for attendees who opt in",
                "Every date and time in the event's own timezone",
                "Works on any phone, no app download",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Layers size={16} className="mt-0.5 shrink-0 text-gold-300" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <section className="mt-16" aria-labelledby="partner-heading">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Working together</p>
              <h2 id="partner-heading" className="mt-3 font-display text-2xl text-navy-950 sm:text-3xl">
                Plans for event organisers
              </h2>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {PARTNER_OPTIONS.map((option) => (
                <div
                  key={option.title}
                  className={
                    option.highlight
                      ? "rounded-2xl bg-navy-950 p-6 text-ivory-50 shadow-sm"
                      : "rounded-2xl border border-navy-950/10 bg-white p-6 shadow-sm"
                  }
                >
                  <h3 className={option.highlight ? "font-display text-xl text-gold-300" : "font-display text-xl text-navy-950"}>
                    {option.title}
                  </h3>
                  <p className={option.highlight ? "mt-2 font-display text-2xl text-ivory-50" : "mt-2 font-display text-2xl text-navy-950"}>
                    {option.price}
                  </p>
                  <p className={option.highlight ? "mt-2 text-sm text-ivory-100/75" : "mt-2 text-sm text-navy-700/80"}>
                    {option.body}
                  </p>
                  <a
                    href={option.href}
                    {...(option.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className={
                      option.highlight
                        ? "mt-4 inline-block text-sm font-medium text-gold-300 underline underline-offset-4"
                        : "mt-4 inline-block text-sm font-medium text-gold-700 underline underline-offset-4"
                    }
                  >
                    {option.cta}
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-navy-700/80">
              Bonus: list your business for free in the{" "}
              <Link href="/business" className="font-medium text-gold-700 underline underline-offset-4">
                EveryMoment vendor directory
              </Link>
              .
            </p>
          </section>

          <section className="mt-16 rounded-3xl border border-gold-500/20 bg-white p-8 sm:p-10" aria-labelledby="pilot-heading">
            <h2 id="pilot-heading" className="font-display text-2xl text-navy-950">
              Pilot it on your next event
            </h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PILOT_STEPS.map((step, i) => (
                <li key={step} className="border-t-2 border-gold-500 pt-4">
                  <span className="font-display text-2xl text-gold-600">{i + 1}</span>
                  <p className="mt-1 text-sm text-navy-950">{step}</p>
                </li>
              ))}
            </ol>
            <Button asChild size="lg" className="mt-8">
              <a href={ORGANISER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Book a demo on WhatsApp
              </a>
            </Button>
          </section>

          <div className="mt-16 text-center">
            <Images className="mx-auto text-gold-500" size={28} aria-hidden="true" />
            <h2 className="mt-3 font-display text-2xl text-navy-950">Planning an event for a client?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-navy-700/80">
              Build a draft in minutes and see the full attendee experience before you pay anything.
            </p>
            <form action={beginDraftAction} className="mt-6">
              <input type="hidden" name="segment" value="corporate" />
              <Button type="submit" size="lg">
                Start building
              </Button>
            </form>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
