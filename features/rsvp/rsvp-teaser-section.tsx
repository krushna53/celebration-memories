import { MailCheck } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { QuickRsvp } from "@/features/rsvp/quick-rsvp";
import { getRsvpConfig } from "@/services/rsvp-config";
import { getEventSegment } from "@/lib/event-segment";
import type { EventCategory } from "@/types/event";

interface RsvpTeaserSectionProps {
  eventId?: string;
  eventSlug?: string;
  publicRsvpEnabled?: boolean;
  honoreeName?: string;
  /** Picks professional default RSVP wording for corporate-type events. */
  category?: EventCategory | null;
}

/**
 * The homepage RSVP anchor section. Normally guests RSVP through their
 * own personal invitation link, so this just points them there. When an
 * event has opted into a shared RSVP link (events.public_rsvp_enabled —
 * see Event Settings), the actual self-service form is embedded right
 * here — no extra click to a separate page — for visitors who arrived
 * through a shared/direct link rather than a personal invitation. That
 * form is the 3-click QuickRsvp (Yes → Confirm with Google → done), with
 * the original phone-based form one tap away for guests without Google.
 */
export async function RsvpTeaserSection({
  eventId,
  eventSlug,
  publicRsvpEnabled,
  honoreeName = "",
  category,
}: RsvpTeaserSectionProps) {
  const showPublicForm = Boolean(publicRsvpEnabled && eventSlug && eventId);
  const rsvpConfig = showPublicForm && eventId ? await getRsvpConfig(eventId) : undefined;

  return (
    <section id="rsvp" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-6 text-center">
        <Reveal>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
            <MailCheck size={26} />
          </div>
          {showPublicForm ? (
            <>
              <SectionHeading eyebrow="Kindly Respond" title="Will you be joining us?" />
              <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-navy-700/80 sm:text-base">
                One quick reply — say yes and confirm with Google. Got a
                personal invitation link? Use that one instead.
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
            <QuickRsvp eventSlug={eventSlug!} eventId={eventId!} honoreeName={honoreeName} rsvpConfig={rsvpConfig} segment={getEventSegment(category)} />
          </Reveal>
        </div>
      ) : null}
    </section>
  );
}
