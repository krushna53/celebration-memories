import Link from "next/link";
import { Images, Upload } from "lucide-react";

import { getMemoryWallItems } from "@/services/memory-wall";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { MemoryCard } from "@/features/memory-wall/components/memory-card";

interface MemoryWallSectionProps {
  eventId: string;
  eventSlug: string;
  /** Only link to the public "share a memory" page when the host has actually turned it on — otherwise a guest lands on that page's "This link isn't open right now" fallback instead of somewhere useful. */
  publicMemoriesEnabled: boolean;
}

/**
 * Public "Memory Wall" — approved guest photos/videos/audio/guestbook
 * messages, newest first. Revalidates periodically (rather than being
 * fully static) so new approvals show up without a full redeploy, and
 * degrades to a friendly empty state if Supabase isn't reachable/
 * configured instead of breaking the whole homepage build.
 */
export async function MemoryWallSection({ eventId, eventSlug, publicMemoriesEnabled }: MemoryWallSectionProps) {
  let items: Awaited<ReturnType<typeof getMemoryWallItems>> = [];

  try {
    items = await getMemoryWallItems(eventId);
  } catch (err) {
    console.error("MemoryWallSection failed to load:", err);
  }

  return (
    <section id="memories" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Shared With Love"
          title="Memory Wall"
          description="Photos, videos, voice messages, and notes from everyone celebrating with us."
        />

        {publicMemoriesEnabled ? (
          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link href={`/events/${eventSlug}/memories`}>
                <Upload size={16} />
                Share Your Memory
              </Link>
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-20 text-center text-navy-700/50">
            <Images size={28} />
            <p className="text-sm">
              Guest memories will appear here as they&rsquo;re shared and reviewed.
            </p>
          </div>
        ) : (
          // Pinterest-style masonry via CSS multi-column (same technique
          // as the Gallery section) rather than a CSS grid — a grid
          // stretches every card in a row to match its tallest neighbor,
          // which looks awkward when a one-line guestbook note sits next
          // to a tall photo or video. Columns let each card be exactly
          // as tall as its own content and stack independently per
          // column, closing the gaps a uniform grid leaves behind.
          <div className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3 [column-fill:_balance]">
            {items.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="mb-5 break-inside-avoid">
                <MemoryCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const memoryWallRevalidateSeconds = 60;
