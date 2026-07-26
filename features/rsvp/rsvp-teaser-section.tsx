import { MailCheck } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";

/**
 * Placeholder for the RSVP section. The real RSVP form — bound to each
 * guest's unique invitation token, with live tracking — ships in
 * Phase 3 (see CLAUDE.md). This keeps the anchor/nav link meaningful
 * in the meantime instead of pointing at an empty spot on the page.
 */
export function RsvpTeaserSection() {
  return (
    <section id="rsvp" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-6 text-center">
        <Reveal>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
            <MailCheck size={26} />
          </div>
          <SectionHeading
            eyebrow="Kindly Respond"
            title="Your Personal Invitation Is On Its Way"
          />
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-navy-700/80 sm:text-base">
            Each guest receives a personal invitation link by WhatsApp or
            email — simply open it to RSVP, no account needed. If you&rsquo;ve
            received your link, use it to confirm; if not, it will arrive
            shortly.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
