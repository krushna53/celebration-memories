import { Heart } from "lucide-react";

import { BUILDER } from "@/lib/constants";

/**
 * Global footer. Per spec, always credits Krushna Web Works and links
 * out to a pre-filled WhatsApp inquiry, opened in a new tab.
 */
export function Footer() {
  return (
    <footer className="border-t border-gold-500/20 bg-navy-950 py-10 text-center text-ivory-100/70">
      <p className="flex items-center justify-center gap-1.5 text-sm">
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
