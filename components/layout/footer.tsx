import Link from "next/link";
import { Heart } from "lucide-react";

import { BUILDER, SITE_NAME } from "@/lib/constants";

interface FooterProps {
  /** Set only when the active template is a community submission — see templates/CommunityTemplate. */
  designerCredit?: { name: string; website?: string | null };
  /**
   * "full" (default) shows every platform-acquisition link (Explore
   * Public Events, Build Your Own, Submit a Template, Pricing, Who Can
   * Do What) — right for the platform marketing pages and an event's
   * own homepage, where "look what's possible" discovery fits naturally.
   * "minimal" drops those and keeps just the legal pages (Terms,
   * Privacy, Cancellation & Refunds, Shipping), Contact, and the credit
   * line — used on task-focused guest pages (RSVP, Memory upload, a
   * personal invite link) where a guest just wants to finish one thing,
   * not be pitched the platform — and matters even more for a somber
   * event (an obituary-category site's RSVP page really shouldn't be
   * next to "Build Your Own Celebration Site!").
   */
  variant?: "full" | "minimal";
}

/**
 * Global footer. Per spec, always credits Krushna Web Works and links
 * out to a pre-filled WhatsApp inquiry, opened in a new tab. Also
 * surfaces the platform-level pages (public events directory, marketing
 * page) that sit alongside any individual event's site — see `variant`
 * above for where that's dialed back.
 */
const footerLinkClass = "transition-luxury duration-300 hover:text-gold-300";

const FOOTER_COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: "Explore",
    links: [
      { href: "/events", label: "Explore Public Events" },
      { href: "/guide", label: "Visitor Guide" },
      { href: "/roles", label: "Who Can Do What" },
    ],
  },
  {
    heading: "Get Started",
    links: [
      { href: "/", label: "Build Your Own Celebration Site" },
      { href: "/templates/submit", label: "Submit a Template" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Notice" },
      { href: "/refund-policy", label: "Cancellation & Refunds" },
      { href: "/shipping-policy", label: "Shipping Policy" },
    ],
  },
  {
    heading: "Support",
    links: [{ href: "/contact", label: "Contact Us" }],
  },
];

const MINIMAL_LINKS = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Notice" },
  { href: "/refund-policy", label: "Cancellation & Refunds" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/contact", label: "Contact Us" },
];

export function Footer({ designerCredit, variant = "full" }: FooterProps = {}) {
  return (
    <footer className="border-t border-gold-500/20 bg-navy-950 py-12 text-ivory-100/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {variant === "full" ? (
          <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4 sm:text-left">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300/70">
                  {column.heading}
                </p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={footerLinkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-sm tracking-wide">
            {MINIMAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={footerLinkClass}>
                {link.label}
              </Link>
            ))}
          </p>
        )}

        <div
          className={
            variant === "full"
              ? "mt-10 border-t border-gold-500/10 pt-8 text-center"
              : "mt-6 text-center"
          }
        >
          <p className="text-sm text-ivory-100/40">
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          {designerCredit ? (
            <p className="mt-2 text-sm text-ivory-100/50">
              Template design by{" "}
              {designerCredit.website ? (
                <a
                  href={designerCredit.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-300/80 underline underline-offset-2 hover:text-gold-200"
                >
                  {designerCredit.name}
                </a>
              ) : (
                <span className="text-ivory-100/70">{designerCredit.name}</span>
              )}
            </p>
          ) : null}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ivory-100/50">
            Made with <Heart size={11} className="fill-gold-400 text-gold-400" />{" "}
            by{" "}
            <a
              href={BUILDER.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gold-300/90 transition-luxury duration-300 hover:text-gold-200"
            >
              {BUILDER.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
