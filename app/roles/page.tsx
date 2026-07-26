import Link from "next/link";
import { Check, X } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { BUILDER } from "@/lib/constants";

interface Persona {
  eyebrow: string;
  title: string;
  image: string;
  imageAlt: string;
  description: string;
  description2?: string;
  canDo: string[];
  pages: { label: string; href: string }[];
}

const PERSONAS: Persona[] = [
  {
    eyebrow: "No account needed",
    title: "Guests & Visitors",
    image: "/roles/guest.svg",
    imageAlt: "Illustration of a guest RSVPing on a phone",
    description:
      "Anyone with a link — a personal invitation, a shared public link, or just browsing. Nothing to sign up for.",
    canDo: [
      "View the event site — hero, countdown, details, gallery, timeline",
      "RSVP, either through a personal invitation link or a public RSVP page (if the host has turned it on)",
      "Upload photos, videos, and voice messages from their phone",
      "Sign the guest book",
      "See the shared Memory Wall once the host approves what's posted",
      "Browse other public events, or reach out via Contact Us",
    ],
    pages: [
      { label: "Homepage", href: "/" },
      { label: "Public Events Directory", href: "/events" },
      { label: "Any event's page", href: "/events" },
      { label: "Public RSVP (if enabled)", href: "/events" },
      { label: "Personal invite link", href: "/" },
      { label: "Visitor Guide", href: "/guide" },
      { label: "Contact Us", href: "/contact" },
      { label: "Platform info", href: "/" },
      { label: "Privacy Notice", href: "/privacy" },
    ],
  },
  {
    eyebrow: "Sign in required",
    title: "Event Hosts",
    image: "/roles/host.svg",
    imageAlt: "Illustration of a host's dashboard",
    description:
      "The person the event is for — created by self-registration or by the platform owner. Full control over their own event's content, with agency-only tools kept out of view.",
    description2:
      "Can't see: the guest list or phone numbers, referral payouts, Contact Us inquiries, or event-day check-in.",
    canDo: [
      "Edit Event Settings — date, venue, WhatsApp invite message, homepage section order, Link Preview Image, Public RSVP toggle",
      "Pick and switch between all 7 templates",
      "Manage the Gallery and Timeline",
      "Approve, feature, or remove guest-submitted Memories",
      "Generate a shareable invitation image (manual or AI, capped per event)",
    ],
    pages: [
      { label: "Overview", href: "/admin" },
      { label: "Event Settings", href: "/admin" },
      { label: "Templates", href: "/admin" },
      { label: "Gallery", href: "/admin" },
      { label: "Timeline", href: "/admin" },
      { label: "Memories", href: "/admin" },
      { label: "Share Image", href: "/admin" },
      { label: "AI Image (capped)", href: "/admin" },
      { label: "Help", href: "/admin" },
    ],
  },
  {
    eyebrow: "Krushna Web Works",
    title: "Platform Owner",
    image: "/roles/owner.svg",
    imageAlt: "Illustration representing full administrative access",
    description:
      "The agency running the platform. Everything a host can do, plus the tools that manage guests directly and keep the business running.",
    canDo: [
      "Everything Event Hosts can do, with no cap on AI Image generations",
      "Manage the full guest list — add, edit, CSV import, generate unique invite links",
      "Send WhatsApp invites individually or via the Bulk Send queue",
      "Track and pay out referrals",
      "Read and respond to Contact Us inquiries",
      "Run event-day Check-In",
      "Bulk-download all guest media",
    ],
    pages: [
      { label: "Everything Event Hosts see, plus:", href: "/admin" },
      { label: "Invitees", href: "/admin" },
      { label: "Referrals", href: "/admin" },
      { label: "Inquiries", href: "/admin" },
      { label: "Check-In", href: "/admin" },
    ],
  },
];

/**
 * Public page explaining the platform's three access levels — for
 * prospective clients (or anyone curious) evaluating what they'd get
 * before asking Krushna Web Works to build them a site. Distinct from
 * /guide (a guest-only walkthrough) and /admin/help (an in-dashboard
 * reference for signed-in admins) — this is the one place that lays
 * out all three roles side by side.
 */
export default function RolesPage() {
  return (
    <SiteShell honoreeName="Celebration Memories">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <SectionHeading
            eyebrow="Who Uses This Platform"
            title="One Site, Three Kinds of Access"
            description="Every Celebration Memories site works the same way underneath: guests never need an account, hosts get a full dashboard for their own event, and the platform owner keeps the guest-sensitive tools to themselves."
          />
        </div>

        <div className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
          <div className="grid gap-10">
            {PERSONAS.map((persona, i) => (
              <Reveal key={persona.title} delay={i * 0.06}>
                <div className="grid gap-6 rounded-2xl border border-navy-950/10 bg-white p-6 sm:p-8 md:grid-cols-[220px_1fr]">
                  <div className="flex flex-col items-center text-center md:items-start md:text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={persona.image}
                      alt={persona.imageAlt}
                      className="w-full max-w-[200px] rounded-xl"
                    />
                    <p className="mt-4 text-xs uppercase tracking-[0.25em] text-gold-600">
                      {persona.eyebrow}
                    </p>
                    <h2 className="mt-1 font-display text-xl text-navy-950">{persona.title}</h2>
                  </div>

                  <div>
                    <p className="text-sm leading-relaxed text-navy-700/80">{persona.description}</p>
                    {persona.description2 ? (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-navy-700/50">
                        <X size={14} className="mt-0.5 shrink-0 text-red-400" />
                        {persona.description2}
                      </p>
                    ) : null}

                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {persona.canDo.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-navy-700/80">
                          <Check size={15} className="mt-0.5 shrink-0 text-gold-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-4 text-xs uppercase tracking-[0.15em] text-navy-700/50">
                      Pages
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {persona.pages.map((page) => (
                        <Link
                          key={page.label}
                          href={page.href}
                          className="rounded-full bg-navy-950/5 px-2.5 py-1 text-xs text-navy-700/70 transition-luxury duration-200 hover:bg-gold-500/10 hover:text-gold-700"
                        >
                          {page.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-sm text-navy-700/70">
              Want a site like this for your own event?
            </p>
            <Button size="lg" className="mt-4" asChild>
              <a href={BUILDER.whatsappUrl} target="_blank" rel="noopener noreferrer">
                Start On WhatsApp
              </a>
            </Button>
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
