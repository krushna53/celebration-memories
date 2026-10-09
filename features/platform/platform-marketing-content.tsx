import Link from "next/link";
import {
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  Camera,
  CreditCard,
  Film,
  Gamepad2,
  Heart,
  LayoutDashboard,
  Link2,
  ListChecks,
  MessageCircle,
  Palette,
  PartyPopper,
  Send,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { BUILDER, SUPPORT } from "@/lib/constants";
import { getPlatformVideoSettings } from "@/services/platform-video-settings";
import { FeatureVideoSection } from "@/features/platform/feature-video-section";
import { TestimonialsSection } from "@/features/testimonials/testimonials-section";
import { VideoTestimonialSection } from "@/features/testimonials/video-testimonial-section";
import { HowItWorksSection } from "@/features/platform/how-it-works-section";
import { StartBuildingButton } from "@/features/start/start-building-button";

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
  {
    icon: ListChecks,
    title: "Built-in event planner",
    description:
      "To-do lists and notes for the whole planning process — share one link with family so everyone can pitch in on tasks, no separate logins needed.",
  },
  {
    icon: Gamepad2,
    title: "Digital party games",
    description:
      "Word Search, Housie (Tambola), and Movie Name Housie — guests join with a scan of a QR code, play on their own phone, and claim prizes live.",
  },
  {
    icon: Film,
    title: "Auto-generated slideshow video",
    description:
      "Turn your gallery into a music-backed highlight video in minutes — pick photos, captions, and a theme, and it renders automatically.",
  },
  {
    icon: CreditCard,
    title: "Pay your way",
    description:
      "Stripe, Razorpay, or CCAvenue for card and UPI checkout — or skip processor fees entirely with a manual UPI QR code and screenshot confirmation.",
  },
  {
    icon: Bot,
    title: "AI host avatar",
    description:
      "A friendly chat widget greets your guests, answers questions, and nudges them toward RSVPing or playing a game — it speaks its replies out loud, and guests can talk back instead of typing.",
  },
  {
    icon: UtensilsCrossed,
    title: "Event Day schedule & menu",
    description:
      "Share a time-blocked run of show and the menu — buffet or à la carte, with dietary tags — on a page guests can check right from their phone on the big day.",
  },
];

/**
 * The homepage's short, grouped version of LIVE_FEATURES — what a host
 * gets before, on and after the day, 4 points each. The full LIVE_FEATURES
 * grid is still one click away under "See all features".
 */
const FEATURE_GROUPS = [
  {
    icon: Send,
    when: "Before the event",
    title: "Invite",
    points: [
      "Beautiful templates, or design an invite with AI",
      "A personal link for every guest — RSVP and meal choice in a tap",
      "Send invites on WhatsApp with ready-made messages",
      "Live RSVP dashboard with spreadsheet export",
    ],
  },
  {
    icon: PartyPopper,
    when: "On the day",
    title: "Celebrate",
    points: [
      "Event Day schedule and menu on every guest's phone",
      "Party games guests join by scanning a QR code",
      "Guest photos and wishes playing on the big screen",
      "A friendly AI host that greets and guides guests",
    ],
  },
  {
    icon: Heart,
    title: "Remember",
    when: "After the event",
    points: [
      "Photos, videos and voice wishes from every guest",
      "A memory wall you approve before anyone sees it",
      "An auto-made highlight video with music",
      "Stored privately — photo links expire, so they can't be passed around",
    ],
  },
] as const;

/**
 * Shared nav for every platform-level (non-event) page — Pricing,
 * Roles, Template submission, Contact, Privacy, and
 * the Visitor Guide. These pages have no #hero/#details/... sections,
 * so they must never fall back to Navbar's default event-page anchors
 * (see components/layout/navbar.tsx's NAV_LINKS) — that mismatch used
 * to leave every platform page's header pointing at anchors that don't
 * exist on it.
 */
export const PLATFORM_NAV_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "AI Image Tool", href: "/ai-invitation-image" },
  { label: "Build RSVP / Form", href: "/forms/new" },
  { label: "Discover", href: "/discover" },
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
export async function PlatformMarketingContent() {
  const videoSettings = await getPlatformVideoSettings();

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin transparentUntilScroll>
      <div className="bg-navy-950 pb-24 pt-32 text-ivory-50 sm:pt-40">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl">
              EveryMoment
            </h1>
            <p className="mt-3 font-display text-xl italic text-gold-300 sm:text-2xl">
              Every Moment Matters.
            </p>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-ivory-100/75 sm:text-lg">
              Create. Celebrate. Remember. A premium, mobile-first invitation
              page for the moments worth gathering for — birthdays, weddings,
              anniversaries, retirements, baby showers, memorials, workshops,
              and more. Unique guest links, live RSVP tracking, a shared wall
              of photos, videos, and messages, a built-in event planner for
              the whole family, and digital party games guests can join by
              scanning a QR code.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StartBuildingButton size="lg">Build Your Event Page — Free to Try</StartBuildingButton>
            </div>
            <p className="mt-6 text-xs text-ivory-100/60">
              Curious what a guest, host, or admin can each do?{" "}
              <Link href="/roles" className="text-gold-300 underline underline-offset-2 hover:text-gold-200">
                See who can do what
              </Link>
              {" · "}
              <Link href="/ai-invitation-image" className="text-gold-300 underline underline-offset-2 hover:text-gold-200">
                Try the free AI Image tool
              </Link>
            </p>
          </Reveal>
        </div>
      </div>

      {/* A real host's video review first, straight under the hero banner. */}
      <VideoTestimonialSection />

      <FeatureVideoSection settings={videoSettings} />

      <HowItWorksSection />

      <div className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Live Today"
            title="Everything You Need To Host, Digitally"
            description="Before, during and after the celebration — one page does it all."
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURE_GROUPS.map((group) => (
              <Reveal key={group.title} className="h-full">
                <div className="h-full rounded-2xl border border-navy-950/10 bg-ivory-50 p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                      <group.icon size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gold-600">{group.when}</p>
                      <h3 className="font-display text-2xl text-navy-950">{group.title}</h3>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2.5 text-base text-navy-700/80">
                    {group.points.map((point) => (
                      <li key={point} className="flex gap-2.5">
                        <Check size={18} className="mt-1 shrink-0 text-gold-500" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <details className="group mt-10">
            <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-gold-600 px-6 py-3 text-sm font-semibold text-gold-600 hover:bg-gold-600/10 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">See all {LIVE_FEATURES.length} features</span>
              <span className="hidden group-open:inline">Show fewer</span>
              <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {LIVE_FEATURES.map((feature) => (
                <div key={feature.title} className="h-full rounded-2xl border border-navy-950/10 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                    <feature.icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-xl text-navy-950">{feature.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-navy-700/75">{feature.description}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      <TestimonialsSection />

      <div className="bg-navy-950 py-20 text-center text-ivory-50 sm:py-24">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl">
              Want a page like this for your event?
            </h2>
            <p className="mt-4 text-sm text-ivory-100/75 sm:text-base">
              Build it yourself in minutes, free to try — or message {BUILDER.name} on WhatsApp and we&rsquo;ll set it up for you.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StartBuildingButton size="lg" formClassName="w-full sm:w-auto" className="w-full sm:w-auto">
                Build It Free Yourself
              </StartBuildingButton>
              <Button size="lg" variant="outline" className="w-full border-ivory-100/30 sm:w-auto bg-transparent text-ivory-50 hover:bg-ivory-50/10 hover:text-ivory-50" asChild>
                <a href={BUILDER.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Or Let Us Set It Up on WhatsApp
                </a>
              </Button>
            </div>
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
