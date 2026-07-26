import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";

interface RsvpTeaserSectionProps {
  eventSlug?: string;
  publicRsvpEnabled?: boolean;
}

/**
 * The homepage RSVP anchor section. Normally guests RSVP through their
 * own personal invitation link, so this just points them there. When an
 * event has opted into a shared RSVP link (events.public_rsvp_enabled —
 * see Event Settings), it shows an "RSVP Now" button straight to
 * /events/[slug]/rsvp instead, for hosts who can't distribute a unique
 * link to every guest.
 */
export function RsvpTeaserSection({ eventSlug, publicRsvpEnabled }: RsvpTeaserSectionProps) {
  return (
    <section id="rsvp" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-6 text-center">
        <Reveal>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
            <MailCheck size={26} />
          </div>
          {publicRsvpEnabled && eventSlug ? (
            <>
              <SectionHeading eyebrow="Kindly Respond" title="RSVP Right Here" />
              <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-navy-700/80 sm:text-base">
                No personal invitation link needed — tap below to let us know
                if you&rsquo;ll be joining.
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link href={`/events/${eventSlug}/rsvp`}>RSVP Now</Link>
              </Button>
            </>
          ) : (
            <>
              <SectionHeading
                eyebrow="Kindly Respond"
                title="Your Personal Invitation Is On Its Way"
              />
              <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-navy-700/80 sm:text-base">
                Each guest receives a personal invitation link by WhatsApp or
                email — simply open it to RSVP, no account needed. If
                you&rsquo;ve received your link, use it to confirm; if not, it
                will arrive shortly.
              </p>
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
