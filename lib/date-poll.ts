import { formatEventDate, formatEventTimeRange } from "@/lib/timezone";

/**
 * Shared shapes for the date poll (services/date-poll.ts) — safe to import
 * from client components, so the guest and admin UIs format candidate
 * dates exactly the way the rest of the site formats the real one.
 */
export interface DatePollVoter {
  name: string;
}

export interface DatePollOption {
  id: string;
  /** ISO instant. */
  startAt: string;
  /** ISO instant, or null for "onwards" (no end time). */
  endAt: string | null;
  label: string | null;
  voters: DatePollVoter[];
}

export interface DatePoll {
  open: boolean;
  timezone: string;
  options: DatePollOption[];
  /** Distinct people who have voted for at least one date. */
  voterCount: number;
}

/** Same 5-hour stand-in the Event Settings form uses when there's no end time. */
export const OPEN_ENDED_DURATION_MS = 5 * 60 * 60 * 1000;

export const MAX_POLL_OPTIONS = 10;

/** "Sunday, August 23, 2026" + "11:00 AM IST – 3:00 PM IST" (or "… onwards"). */
export function formatPollOption(option: Pick<DatePollOption, "startAt" | "endAt">, timezone: string): { date: string; time: string } {
  const endAt = option.endAt ?? new Date(Date.parse(option.startAt) + OPEN_ENDED_DURATION_MS).toISOString();
  return {
    date: formatEventDate(option.startAt, timezone),
    time: formatEventTimeRange({ startAt: option.startAt, endAt, hasEndTime: option.endAt !== null }, timezone),
  };
}
