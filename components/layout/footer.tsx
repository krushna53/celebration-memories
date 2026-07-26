import Link from "next/link";
import { Heart } from "lucide-react";

import { BUILDER } from "@/lib/constants";

/**
 * Global footer. Per spec, always credits Krushna Web Works and links
 * out to a pre-filled WhatsApp inquiry, opened in a new tab. Also
 * surfaces the platform-level pages (public events directory, marketing
 * page) that sit alongside any individual event's site.
 */
export function Footer() {
  return (
    <footer className="border-t border-gold-500/20 bg-navy-950 py-10 text-center text-ivory-100/70">
      <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs tracking-wide">
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
          href="/platform"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Build Your Own Celebration Site
        </Link>
        <Link
          href="/roles"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Who Can Do What
        </Link>
        <Link
          href="/privacy"
          className="transition-luxury duration-300 hover:text-gold-300"
        >
          Privacy Notice
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
    </footer>
  );
}
