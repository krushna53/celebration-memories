import { MailCheck } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { PublicRsvpForm } from "@/features/rsvp/public-rsvp-form";

interface RsvpTeaserSectionProps {
  eventId?: string;
  eventSlug?: string;
  publicRsvpEnabled?: boolean;
  honoreeName?: string;
}

/**
 * The homepage RSVP anchor section. Normally guests RSVP through their
 * own personal invitation link, so this just points them there. When an
 * event has opted into a shared RSVP link (events.public_rsvp_enabled —
 * see Event Settings), the actual self-service form is embedded right
 * here — no extra click to a separate page — for visitors who arrived
 * through a shared/direct link rather than a personal invitation.
 */
export function RsvpTeaserSection({
  eventId,
  eventSlug,
  publicRsvpEnabled,
  honoreeName = "",
}: RsvpTeaserSectionProps) {
  const showPublicForm = Boolean(publicRsvpEnabled && eventSlug && eventId);

  return (
    <section id="rsvp" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-6 text-center">
        <Reveal>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
            <MailCheck size={26} />
          </div>
          {showPublicForm ? (
            <>
              <SectionHeading eyebrow="Kindly Respond" title="RSVP Right Here" />
              <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-navy-700/80 sm:text-base">
                If you were sent your own personal invitation link, please use
                that one instead — it keeps your response tied to your
                invitation. If you&rsquo;re here through a link that was
                shared directly (not a personal invitation), fill out the
                form below to let us know if you&rsquo;ll be joining.
              </p>
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

      {showPublicForm ? (
        <div className="mx-auto mt-10 max-w-xl px-6">
          <Reveal delay={0.1}>
            <PublicRsvpForm eventSlug={eventSlug!} eventId={eventId!} honoreeName={honoreeName} />
          </Reveal>
        </div>
      ) : null}
    </section>
  );
}
