"use client";

import { useEffect, useState } from "react";

export interface CountdownValue {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function computeRemaining(targetIso: string): CountdownValue {
  const diff = new Date(targetIso).getTime() - Date.now();
  const clamped = Math.max(diff, 0);
  return {
    days: Math.floor(clamped / (1000 * 60 * 60 * 24)),
    hours: Math.floor((clamped / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((clamped / (1000 * 60)) % 60),
    seconds: Math.floor((clamped / 1000) % 60),
    isPast: diff <= 0,
  };
}

/**
 * Ticking countdown to a target ISO timestamp. Returns `null` until the
 * first client-side tick so server-rendered markup never mismatches the
 * client (the initial render intentionally shows placeholder dashes).
 */
export function useCountdown(targetIso: string): CountdownValue | null {
  const [value, setValue] = useState<CountdownValue | null>(null);

  useEffect(() => {
    setValue(computeRemaining(targetIso));
    const id = setInterval(() => setValue(computeRemaining(targetIso)), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return value;
}
