import { ACTIVE_EVENT } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

/**
 * Formal invitation copy + primary call-to-action, sitting between the
 * Countdown and Event Details sections per the homepage spec order.
 */
export function InvitationSection() {
  return (
    <section id="invitation" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.35em] text-gold-500">
            You Are Warmly Invited
          </p>

          <h2 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
            With hearts full of gratitude, {ACTIVE_EVENT.hostedBy} invites you
            to celebrate
          </h2>

          <p className="mt-3 font-display text-2xl italic text-gold-600 sm:text-3xl">
            {ACTIVE_EVENT.honoreeName}&rsquo;s {ACTIVE_EVENT.eventTitle}
          </p>

          <div className="divider-gold mx-auto mt-6 w-24" />

          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-navy-700/85 sm:text-base">
            Seventy-five years is a lifetime of memories, milestones, and
            moments shared with the people who matter most. We would be
            honoured to have you join us as we celebrate this remarkable
            occasion together.
          </p>

          <p className="mt-6 text-sm tracking-wide text-navy-700/70">
            {ACTIVE_EVENT.dayOfWeek}, {ACTIVE_EVENT.date} &middot;{" "}
            {ACTIVE_EVENT.startTime} &ndash; {ACTIVE_EVENT.endTime}
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
