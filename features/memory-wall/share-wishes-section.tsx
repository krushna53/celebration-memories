import Link from "next/link";
import { Mic, PenLine, Video, type LucideIcon } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

interface ShareWishesSectionProps {
  eventSlug: string;
  /** Who the wishes are for — "Kunal & Aanchal", "Mahesh J. Shah"… */
  honoreeName: string;
}

const WAYS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Video, title: "Video message", text: "Record a few heartfelt words on your phone" },
  { icon: Mic, title: "Voice note", text: "Speak your blessing, just like a phone call" },
  { icon: PenLine, title: "Written wish", text: "Type a message they can read again and again" },
];

/**
 * "Share a wish or a memory" call-to-action, shown right under the RSVP — for guests who can't attend and for
 * those who can but have something to say. Links to the public no-token memories page, so callers render it only
 * when events.public_memories_enabled is on.
 */
export function ShareWishesSection({ eventSlug, honoreeName }: ShareWishesSectionProps) {
  return (
    <section id="share-wishes" className="bg-ivory-100 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <SectionHeading
            eyebrow="Can't Make It? Or Have Something to Say?"
            title="Send Your Wishes"
            description={`Whether you'll be there in person or celebrating from afar, your words will mean the world to ${honoreeName}. Leave a video, a voice note or a written wish — it will be treasured long after the day itself.`}
          />
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {WAYS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-gold-500/20 bg-ivory-50 px-5 py-6">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                  <Icon size={20} aria-hidden />
                </div>
                <p className="font-display text-lg text-navy-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-700/75">{text}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Button asChild size="lg">
              <Link href={`/events/${eventSlug}/memories`}>Share Your Wishes</Link>
            </Button>
            <p className="text-xs text-navy-700/60">No app or sign-up needed — it takes less than a minute.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
