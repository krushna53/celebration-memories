import Link from "next/link";
import { Heart } from "lucide-react";

import { BUILDER } from "@/lib/constants";

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
export function Footer({ designerCredit, variant = "full" }: FooterProps = {}) {
  return (
    <footer className="border-t border-gold-500/20 bg-navy-950 py-10 text-center text-ivory-100/70">
      <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs tracking-wide">
        {variant === "full" ? (
          <>
            <Link
              href="/guide"
              className="transition-luxury duration-300 hover:text-gold-300"
            >
              Visitor Guide
            </Link>
            <Link
              href="/events"
              className="transition-luxury duration-300 hover:text-gold-300"
            >
              Explore Public Events
            </Link>
            <Link
              href="/"
              className="transition-luxury duration-300 hover:text-gold-300"
            >
              Build Your Own Celebration Site
            </Link>
            <Link
              href="/pricing"
              className="transition-luxury duration-300 hover:text-gold-300"
            >
              Pricing
            </Link>
            <Link
              href="/templates/submit"
              className="transition-luxury duration-300 hover:text-gold-300"
            >
              Submit a Template
            </Link>
            <Link
              href="/roles"
              className="transition-luxury duration-300 hover:text-gold-300"
            >
              Who Can Do What
            </Link>
          </>
        ) : null}
        <Link
          href="/terms"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Terms & Conditions
        </Link>
        <Link
          href="/privacy"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Privacy Notice
        </Link>
        <Link
          href="/refund-policy"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Cancellation & Refunds
        </Link>
        <Link
          href="/shipping-policy"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Shipping Policy
        </Link>
        <Link
          href="/contact"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Contact Us
        </Link>
      </p>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-sm">
        Made with <Heart size={14} className="fill-gold-400 text-gold-400" />{" "}
        by{" "}
        <a
          href={BUILDER.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gold-300 transition-luxury duration-300 hover:text-gold-200"
        >
          {BUILDER.name}
        </a>
      </p>
      {designerCredit ? (
        <p className="mt-2 text-xs text-ivory-100/50">
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
    </footer>
  );
}
