"use client";

import { ACTIVE_EVENT } from "@/lib/constants";
import { useCountdown } from "@/hooks/use-countdown";

/**
 * Compact countdown used inside the hero glass card. The full dedicated
 * countdown section (larger digits) lives in features/countdown.
 */
export function CountdownBadge() {
  const remaining = useCountdown(ACTIVE_EVENT.isoStart);

  const units: Array<{ label: string; value: number | null }> = [
    { label: "Days", value: remaining?.days ?? null },
    { label: "Hours", value: remaining?.hours ?? null },
    { label: "Min", value: remaining?.minutes ?? null },
    { label: "Sec", value: remaining?.seconds ?? null },
  ];

  return (
    <div
      className="grid grid-cols-4 gap-3 sm:gap-4"
      role="timer"
      aria-live="polite"
      aria-label="Countdown to the celebration"
    >
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex flex-col items-center rounded-xl border border-gold-400/25 bg-navy-900/40 px-2 py-3"
        >
          <span className="font-display text-2xl text-gold-300 sm:text-3xl tabular-nums">
            {unit.value === null ? "--" : String(unit.value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ivory-100/60 sm:text-xs">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
