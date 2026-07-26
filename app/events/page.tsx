import Link from "next/link";
import { CalendarDays, MapPin, PartyPopper } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { listPublicEvents } from "@/services/events";
import { getCoverPhoto } from "@/services/gallery-photos";
import { formatEventDate } from "@/lib/format";
import type { EventCategory } from "@/types/event";

export const revalidate = 60;

const CATEGORY_LABELS: Record<EventCategory, string> = {
  birthday: "Birthday",
  wedding: "Wedding",
  anniversary: "Anniversary",
  retirement: "Retirement",
  baby_shower: "Baby Shower",
  corporate: "Corporate",
};

/**
 * Public directory of every event that has opted into being listed
 * (events.visibility = 'public'). Private events never appear here —
 * they're only reachable via their direct /events/[slug] or per-guest
 * invite link. Any kind of event is welcome here, not just birthdays:
 * weddings, anniversaries, baby showers, corporate milestones, and so on.
 */
export default async function PublicEventsDirectoryPage() {
  let events: Awaited<ReturnType<typeof listPublicEvents>> = [];

  try {
    events = await listPublicEvents();
  } catch (err) {
    console.error("PublicEventsDirectoryPage failed to load events:", err);
  }

  const covers = await Promise.all(
    events.map(async (event) => {
      try {
        return await getCoverPhoto(event.id);
      } catch {
        return null;
      }
    }),
  );

  return (
    <SiteShell honoreeName="Celebration Memories">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Open Invitations"
            title="Public Celebrations"
            description="Browse events that have chosen to be openly listed — birthdays, weddings, anniversaries, and more. Private events stay off this page and are shared only by direct link."
          />

          {events.length === 0 ? (
            <div className="mt-14 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-20 text-center text-navy-700/50">
              <PartyPopper size={28} />
              <p className="text-sm">No public events yet — check back soon.</p>
            </div>
          ) : (
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event, i) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group overflow-hidden rounded-2xl border border-navy-950/10 bg-white shadow-sm transition-luxury duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-navy-950/5">
                    {covers[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={covers[i] ?? undefined}
                        alt=""
                        className="h-full w-full object-cover transition-luxury duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gold-500/40">
                        <PartyPopper size={36} />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-navy-950/80 px-3 py-1 text-xs font-medium tracking-wide text-gold-300">
                      {CATEGORY_LABELS[event.category]}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg text-navy-950">
                      {event.honoreeName}
                    </h3>
                    <p className="mt-1 text-sm text-navy-700/70">{event.eventTitle}</p>
                    {event.shortDescription ? (
                      <p className="mt-2 line-clamp-2 text-sm text-navy-700/60">
                        {event.shortDescription}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-1.5 text-xs text-navy-700/60">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-gold-500" />
                        {formatEventDate(event.startAt)}
                      </span>
                      {event.venueName ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-gold-500" />
                          {event.venueName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
