"use client";

import { ACTIVE_EVENT } from "@/lib/constants";
import { useCountdown } from "@/hooks/use-countdown";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";

const UNITS: Array<{ key: "days" | "hours" | "minutes" | "seconds"; label: string }> = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

/**
 * Full-size dedicated countdown section, distinct from the compact
 * badge embedded in the hero card. Continues the hero's dark-navy,
 * gold-accented treatment.
 */
export function CountdownSection() {
  const remaining = useCountdown(ACTIVE_EVENT.isoStart);

  return (
    <section
      id="countdown"
      className="bg-navy-900 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-4xl px-6">
        <Reveal>
          <SectionHeading
            tone="dark"
            eyebrow="The Celebration Begins In"
            title="Counting Down the Moments"
            description="Every second brings us closer to honouring 75 remarkable years."
          />
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {UNITS.map((unit) => (
              <div
                key={unit.key}
                className="glass-card flex flex-col items-center rounded-2xl px-4 py-8"
              >
                <span className="font-display text-4xl text-gold-300 tabular-nums sm:text-5xl">
                  {remaining
                    ? String(remaining[unit.key]).padStart(2, "0")
                    : "--"}
                </span>
                <span className="mt-2 text-xs uppercase tracking-[0.3em] text-ivory-100/60">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
