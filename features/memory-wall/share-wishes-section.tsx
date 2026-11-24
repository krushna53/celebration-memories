import { Reveal } from "@/components/motion/reveal";
import { PublicMemoryUploader } from "@/features/uploads/public-memory-uploader";
import { getSegmentCopy } from "@/lib/event-segment";
import type { EventCategory } from "@/types/event";

interface ShareWishesSectionProps {
  eventSlug: string;
  /** Who the wishes are for — "Kunal & Aanchal", "Mahesh J. Shah"… */
  honoreeName: string;
  /** Picks family vs. corporate eyebrow copy (lib/event-segment.ts); omitted = family. */
  category?: EventCategory | null;
}

/**
 * The public "share a memory" uploader (same as /events/[slug]/memories) right on the homepage, under the RSVP —
 * for guests who can't attend and for those who can but have something to say. Callers render it only when
 * events.public_memories_enabled is on, since the uploader's actions refuse otherwise.
 */
export function ShareWishesSection({ eventSlug, honoreeName, category }: ShareWishesSectionProps) {
  const guestCopy = getSegmentCopy(category).guest;

  return (
    <section id="share-wishes" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.35em] text-gold-500">{guestCopy.publicUploadEyebrow}</p>
          <h2 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">{honoreeName}</h2>
          <div className="divider-gold mx-auto mt-6 w-20" />
          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed tracking-wide text-navy-700/70">
            Can&rsquo;t make it, or coming but have something to say? A video, a voice note, a photo or a few written
            words — it will be treasured long after the day itself.
          </p>
        </Reveal>
      </div>

      <div className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
        <Reveal delay={0.1}>
          <PublicMemoryUploader eventSlug={eventSlug} honoreeName={honoreeName} />
        </Reveal>
      </div>
    </section>
  );
}
