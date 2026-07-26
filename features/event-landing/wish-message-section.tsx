import type { EventDisplayData } from "@/lib/event-display";
import { getWishSectionCopy } from "@/lib/event-category";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";

interface WishMessageSectionProps {
  data: EventDisplayData;
}

/**
 * Free-text message section, positioned below RSVP by default (see
 * lib/section-registry.ts) — a birthday wish, a wedding well-wish, a
 * note of remembrance, or event notes, depending on `data.category`
 * (see lib/event-category.ts for the copy mapping). Renders nothing if
 * the host hasn't written one, so it never shows an empty box.
 */
export function WishMessageSection({ data }: WishMessageSectionProps) {
  if (!data.wishMessage?.trim()) return null;

  const copy = getWishSectionCopy(data.category);

  return (
    <section id="wish" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <Reveal>
          <SectionHeading eyebrow={copy.eyebrow} title={copy.title} />
          <p className="mx-auto mt-8 max-w-xl whitespace-pre-wrap font-display text-lg italic leading-relaxed text-navy-700/85 sm:text-xl">
            &ldquo;{data.wishMessage.trim()}&rdquo;
          </p>
        </Reveal>
      </div>
    </section>
  );
}
