import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upcoming Features — Every Moment",
  robots: { index: false, follow: false },
};

type Status = "next-week" | "soon" | "planned" | "exploring";

interface FeatureItem {
  title: string;
  detail: string;
  status: Status;
}

interface FeatureGroup {
  label: string;
  status: Status;
  color: string;
  items: FeatureItem[];
}

const GROUPS: FeatureGroup[] = [
  {
    label: "Next Week",
    status: "next-week",
    color: "bg-green-500",
    items: [
      {
        title: "Fix desktop layout padding",
        detail: "Content currently has too much empty space on both sides on wide screens. Will be tightened to feel more balanced and premium.",
        status: "next-week",
      },
      {
        title: "\"Need help building this?\" top banner",
        detail: "A full-width banner on the public site with a contact number input field on the right — visitors who want a similar site can drop their number directly.",
        status: "next-week",
      },
      {
        title: "Workshop session seat limits",
        detail: "\"Reserve your spot\" will show remaining seats and display \"Seats Full\" when capacity is reached, preventing over-registration for paid workshop sessions.",
        status: "next-week",
      },
      {
        title: "Sponsored vendor listings",
        detail: "Paid placement for vendors in the marketplace — sponsored vendors appear at the top of category and city pages with a subtle \"Sponsored\" label.",
        status: "next-week",
      },
      {
        title: "Storage limit upsell prompt",
        detail: "When a client's Storage usage crosses a set threshold, they'll see a prompt to upgrade or pay for more storage rather than hitting a silent limit.",
        status: "next-week",
      },
    ],
  },
  {
    label: "Coming Soon",
    status: "soon",
    color: "bg-gold-500",
    items: [
      {
        title: "Newsletter subscription",
        detail: "Guests and visitors can subscribe for weekly platform updates and event reminders. Built on Resend (already integrated).",
        status: "soon",
      },
      {
        title: "Reminder emails + in-app notifications",
        detail: "Automated reminders for guests (RSVP deadline, event day) and hosts (pending approvals, check-in summary). Notification bell already exists — this wires real triggers to it.",
        status: "soon",
      },
      {
        title: "Big Screen display PIN protection",
        detail: "Admin sets a PIN in Event Settings. Anyone opening the display URL sees a PIN entry screen first — simple protection without requiring a login.",
        status: "soon",
      },
      {
        title: "Big Screen time-gated access",
        detail: "The display page only works within a configurable window around the event start time (e.g. ±4 hours). Outside that window it shows a friendly \"not available yet\" screen.",
        status: "soon",
      },
      {
        title: "Photo collections (Google Photos style)",
        detail: "Guests and admins can organise memories into named albums. Optional sync with Google Photos and Facebook timeline linking for the event timeline.",
        status: "soon",
      },
      {
        title: "Template library expansion",
        detail: "New visual templates for weddings, retirement, baby showers, and corporate events — each with its own colour palette, typography, and animation personality.",
        status: "soon",
      },
    ],
  },
  {
    label: "Planned",
    status: "planned",
    color: "bg-navy-500",
    items: [
      {
        title: "Indian National Holiday event scheduler",
        detail: "Pre-built event templates and suggested schedules for non-religious national holidays — Republic Day, Independence Day, Gandhi Jayanti, etc.",
        status: "planned",
      },
      {
        title: "Client mobile experience improvements",
        detail: "Pinned bottom navigation bar on mobile, swipe-to-approve memories, one-tap Share Event sheet, and an Event Day simplified dashboard view.",
        status: "planned",
      },
      {
        title: "Multilingual support",
        detail: "Public event pages available in Hindi, Gujarati, Marathi, Tamil, and other Indian languages. Admin panel stays in English.",
        status: "planned",
      },
      {
        title: "Wedding Planner toolkit",
        detail: "A comprehensive planning module — checklist, budget tracker, vendor management, timeline planner, seating plans, mood boards, and contract templates. Available as an add-on for event hosts.",
        status: "planned",
      },
    ],
  },
  {
    label: "Exploring",
    status: "exploring",
    color: "bg-navy-950/30",
    items: [
      {
        title: "Mobile app (iOS + Android)",
        detail: "Native app with push notifications for guests and hosts. The PWA already works as a home screen app — a native app would add proper push notification support.",
        status: "exploring",
      },
      {
        title: "Membership / subscription model",
        detail: "Netflix-style recurring billing for event hosts — monthly or annual plans with different storage, guest, and feature tiers.",
        status: "exploring",
      },
    ],
  },
];

const STATUS_LABELS: Record<Status, string> = {
  "next-week": "Next Week",
  "soon": "Coming Soon",
  "planned": "Planned",
  "exploring": "Exploring",
};

export default function UpcomingFeaturesPage() {
  return (
    <div className="min-h-screen bg-ivory-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-gold-700">
          Internal — not linked anywhere on the site
        </p>
        <h1 className="mt-2 font-display text-3xl text-navy-950 sm:text-4xl">Upcoming Features</h1>
        <p className="mt-1 text-sm text-navy-700/60">Last updated Sunday, August 23, 2026</p>
        <p className="mt-3 text-sm leading-relaxed text-navy-700/70">
          Everything on the roadmap, roughly in order of when it&rsquo;ll ship. Items move between sections as priorities shift — check back each week.
        </p>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-3">
          {GROUPS.map((g) => (
            <div key={g.status} className="flex items-center gap-1.5 text-xs text-navy-700/70">
              <span className={`h-2 w-2 rounded-full ${g.color}`} />
              {g.label}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-10">
          {GROUPS.map((group) => (
            <section key={group.status}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${group.color}`} />
                <h2 className="font-display text-lg text-navy-950">{group.label}</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {group.items.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-navy-950/10 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-navy-950">{item.title}</h3>
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${group.color}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-navy-700/70">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-gold-500/25 bg-gold-500/5 p-5 text-sm text-navy-700/70">
          <p>
            <span className="font-semibold text-navy-950">Weekly updates: </span>
            See what shipped this week at{" "}
            <Link href="/updates/weekly" className="text-gold-600 underline underline-offset-2">
              /updates/weekly
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
