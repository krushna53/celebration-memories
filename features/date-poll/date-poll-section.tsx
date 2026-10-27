import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { getDatePoll } from "@/services/date-poll";
import { DatePollCard } from "@/features/date-poll/date-poll-card";
import type { EventRecord } from "@/types/event";

/**
 * "Pick a date" homepage section — shown only while the host's date poll
 * is open (services/date-poll.ts). Sits first under the Hero by default
 * (lib/section-registry.ts), since every other date on the page reads
 * "to be decided" until it closes.
 */
export async function DatePollSection({ event }: { event: EventRecord }) {
  if (!event.datePollOpen) return null;
  const poll = await getDatePoll(event.id, event.timezone).catch(() => null);
  if (!poll || poll.options.length === 0) return null;

  return (
    <section id="date-poll" className="scroll-mt-20 bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Help us choose" title="Pick a Date" description="The date isn't fixed yet — tell us which days work for you." />
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <DatePollCard poll={poll} voter={{ kind: "public", eventId: event.id }} />
        </Reveal>
      </div>
    </section>
  );
}
