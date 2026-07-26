"use client";

import { useEffect, useState } from "react";

import { ACTIVE_EVENT } from "@/lib/constants";

function getRemaining() {
  const diff = new Date(ACTIVE_EVENT.isoStart).getTime() - Date.now();
  const clamped = Math.max(diff, 0);
  return {
    days: Math.floor(clamped / (1000 * 60 * 60 * 24)),
    hours: Math.floor((clamped / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((clamped / (1000 * 60)) % 60),
    seconds: Math.floor((clamped / 1000) % 60),
  };
}

/**
 * Compact countdown used inside the hero glass card. The full
 * dedicated countdown section (with larger digits) ships in Phase 2;
 * this lightweight version keeps the hero self-contained for Phase 1.
 */
export function CountdownBadge() {
  const [remaining, setRemaining] = useState<ReturnType<
    typeof getRemaining
  > | null>(null);

  useEffect(() => {
    setRemaining(getRemaining());
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

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
