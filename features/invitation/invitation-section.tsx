import type { EventDisplayData } from "@/lib/event-display";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

interface InvitationSectionProps {
  data: EventDisplayData;
}

/**
 * Formal invitation copy + primary call-to-action, sitting between the
 * Countdown and Event Details sections per the homepage spec order.
 */
export function InvitationSection({ data }: InvitationSectionProps) {
  return (
    <section id="invitation" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.35em] text-gold-500">
            You Are Warmly Invited
          </p>

          <h2 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
            With hearts full of gratitude, {data.hostedBy} invites you to
            celebrate
          </h2>

          <p className="mt-3 font-display text-2xl italic text-gold-600 sm:text-3xl">
            {data.honoreeName}&rsquo;s {data.eventTitle}
          </p>

          <div className="divider-gold mx-auto mt-6 w-24" />

          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-navy-700/85 sm:text-base">
            We would be honoured to have you join us as we celebrate this
            remarkable occasion together, surrounded by the people who
            matter most.
          </p>

          <p className="mt-6 text-sm tracking-wide text-navy-700/70">
            {data.dayOfWeek}, {data.date} &middot; {data.startTime} &ndash;{" "}
            {data.endTime}
          </p>

          <div className="mt-8">
            <Button asChild size="lg">
              <a href="#rsvp">Reserve Your Spot</a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
