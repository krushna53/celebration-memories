import { Images } from "lucide-react";

import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { getMemoryWallItems } from "@/services/memory-wall";
import { SectionHeading } from "@/components/ui/section-heading";
import { MemoryCard } from "@/features/memory-wall/components/memory-card";

/**
 * Public "Memory Wall" — approved guest photos/videos/audio/guestbook
 * messages, newest first. Revalidates periodically (rather than being
 * fully static) so new approvals show up without a full redeploy, and
 * degrades to a friendly empty state if Supabase isn't reachable/
 * configured instead of breaking the whole homepage build.
 */
export async function MemoryWallSection() {
  let items: Awaited<ReturnType<typeof getMemoryWallItems>> = [];

  try {
    const event = await getEventBySlug(EVENT_SLUG);
    if (event) {
      items = await getMemoryWallItems(event.id);
    }
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

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-20 text-center text-navy-700/50">
            <Images size={28} />
            <p className="text-sm">
              Guest memories will appear here as they&rsquo;re shared and reviewed.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <MemoryCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const memoryWallRevalidateSeconds = 60;
