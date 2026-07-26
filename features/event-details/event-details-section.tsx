import { CalendarDays, Car, Clock, MapPin, Shirt } from "lucide-react";

import { ACTIVE_EVENT, VENUE } from "@/lib/constants";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";

interface DetailCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function DetailCard({ icon, label, value }: DetailCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-gold-500/15 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
      <span className="mt-0.5 shrink-0 text-gold-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.25em] text-navy-700/60">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-medium text-navy-950 sm:text-base">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Date / time / venue / parking / dress code, with an embedded map when
 * `VENUE.mapsEmbedUrl` is configured. Falls back to "to be announced"
 * copy so the section never looks broken before real venue details are
 * filled in (see lib/constants.ts → VENUE).
 */
export function EventDetailsSection() {
  return (
    <section id="details" className="bg-ivory-100 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Join Us"
            title="Event Details"
            description="Everything you need to know to plan your visit."
          />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-start">
          <Reveal delay={0.1} className="grid gap-4 sm:grid-cols-2">
            <DetailCard
              icon={<CalendarDays size={20} />}
              label="Date"
              value={`${ACTIVE_EVENT.dayOfWeek}, ${ACTIVE_EVENT.date}`}
            />
            <DetailCard
              icon={<Clock size={20} />}
              label="Time"
              value={`${ACTIVE_EVENT.startTime} – ${ACTIVE_EVENT.endTime}`}
            />
            <DetailCard
              icon={<MapPin size={20} />}
              label="Venue"
              value={VENUE.name ?? "To be announced"}
            />
            <DetailCard
              icon={<Shirt size={20} />}
              label="Dress Code"
              value={VENUE.dressCode ?? "Details coming soon"}
            />
            <DetailCard
              icon={<Car size={20} />}
              label="Parking"
              value={VENUE.parkingInfo ?? "Details coming soon"}
            />

            {VENUE.mapsDirectionsUrl ? (
              <div className="sm:col-span-2">
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <a
                    href={VENUE.mapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get Directions
                  </a>
                </Button>
              </div>
            ) : null}
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-gold-500/15 bg-white shadow-sm lg:aspect-auto lg:h-full lg:min-h-[360px]">
              {VENUE.mapsEmbedUrl ? (
                <iframe
                  src={VENUE.mapsEmbedUrl}
                  title="Venue location"
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 px-8 text-center text-navy-700/50">
                  <MapPin size={28} />
                  <p className="text-sm">
                    Map will appear here once the venue is confirmed.
                  </p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
