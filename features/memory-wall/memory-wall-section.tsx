import Link from "next/link";
import { Upload } from "lucide-react";

import { getMemoryWallItems } from "@/services/memory-wall";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { MemoryCard } from "@/features/memory-wall/components/memory-card";
import { getSegmentCopy } from "@/lib/event-segment";
import type { EventCategory } from "@/types/event";

interface MemoryWallSectionProps {
  eventId: string;
  eventSlug: string;
  /** Only link to the public "share a memory" page when the host has actually turned it on — otherwise a guest lands on that page's "This link isn't open right now" fallback instead of somewhere useful. */
  publicMemoriesEnabled: boolean;
  /** Picks family vs. corporate heading copy (lib/event-segment.ts); omitted = family. */
  category?: EventCategory | null;
}

/**
 * Public "Memory Wall" — approved guest photos/videos/audio/guestbook
 * messages, newest first; renders nothing until at least one is approved. Revalidates periodically (rather than being
 * fully static) so new approvals show up without a full redeploy, and
 * renders nothing if Supabase isn't reachable/configured instead of
 * breaking the whole homepage build.
 */
export async function MemoryWallSection({ eventId, eventSlug, publicMemoriesEnabled, category }: MemoryWallSectionProps) {
  const heading = getSegmentCopy(category).memoryWall;
  let items: Awaited<ReturnType<typeof getMemoryWallItems>> = [];

  try {
    items = await getMemoryWallItems(eventId);
  } catch (err) {
    console.error("MemoryWallSection failed to load:", err);
  }
  // nothing approved yet: no empty wall (the Share Wishes section is where guests add to it)
  if (items.length === 0) return null;

  return (
    <section id="memories" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          description={heading.description}
        />

        {publicMemoriesEnabled ? (
          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link href={`/events/${eventSlug}/memories`}>
                <Upload size={16} />
                {heading.cta}
              </Link>
            </Button>
          </div>
        ) : null}

        {/*
        Pinterest-style masonry via CSS multi-column (same technique
        as the Gallery section) rather than a CSS grid — a grid
        stretches every card in a row to match its tallest neighbor,
        which looks awkward when a one-line guestbook note sits next
        to a tall photo or video. Columns let each card be exactly
        as tall as its own content and stack independently per
        column, closing the gaps a uniform grid leaves behind.
        */}
        <div className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3 [column-fill:_balance]">
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="mb-5 break-inside-avoid">
              <MemoryCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const memoryWallRevalidateSeconds = 60;
