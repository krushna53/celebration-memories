/**
 * The Timeline is always shown oldest → newest. A milestone's date comes
 * from its Period — the text the host sees and edits ("March 1998",
 * "1998–2001", "1960s", "14 March 1998") — with the dates of its photos
 * (taken_from, from the photo import) only refining the order within the
 * same year. The period wins because photo dates can be wrong (a scanned
 * 1965 print carries the day it was scanned).
 *
 * Milestones without a year ("Early years", "Childhood") keep the place
 * the host gave them: each one stays right after the milestone it follows
 * in the manual order, so arrows still work for them.
 *
 * Pure and shared: services/timeline.ts orders every list with it (public
 * Timeline, admin, wizard, slideshow), and the admin manager uses
 * milestoneSortDate to know which milestones the arrows apply to.
 */

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** Whole words only — "Marriage, 1975" must not read as March. */
const MONTHS: Record<string, number> = Object.fromEntries(
  MONTH_NAMES.flatMap((name, i) => [[name, i + 1], [name.slice(0, 3), i + 1], ...(name === "september" ? [["sept", 9]] : [])]),
);

interface Datable {
  period: string;
  sortOrder: number;
  takenFrom?: string | null;
}

/** Milliseconds for the start of whatever the period names, or null when it has no year. */
export function periodDate(period: string): number | null {
  const text = period.toLowerCase();
  const year = text.match(/\b(1[89]\d\d|20\d\d)(?:'?s\b)?/);
  if (!year?.[1]) return null;
  const y = Number(year[1]);
  // Month and day only count when they sit next to the first year ("14 March 1998", "March 1998").
  const before = text.slice(0, year.index ?? 0);
  const monthMatch = before.match(/(?:^|[^a-z])([a-z]{3,9})\.?,?\s*$/);
  const month = monthMatch?.[1] ? MONTHS[monthMatch[1]] : undefined;
  const dayMatch = month ? before.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+[a-z]{3,9}\.?,?\s*$/) : null;
  const day = dayMatch?.[1] ? Number(dayMatch[1]) : 1;
  return Date.UTC(y, (month ?? 1) - 1, day >= 1 && day <= 31 ? day : 1);
}

/** The date a milestone sorts by, or null when it has none. */
export function milestoneSortDate(m: Datable): number | null {
  const fromPeriod = periodDate(m.period);
  const fromPhotos = m.takenFrom && /^\d{4}-\d{2}-\d{2}$/.test(m.takenFrom) ? Date.parse(`${m.takenFrom}T00:00:00Z`) : null;
  if (fromPhotos === null || Number.isNaN(fromPhotos)) return fromPeriod;
  if (fromPeriod === null) return fromPhotos;
  // Same year: the photos' exact day is the finer answer. Different year: trust the period.
  return new Date(fromPhotos).getUTCFullYear() === new Date(fromPeriod).getUTCFullYear() && fromPhotos >= fromPeriod
    ? fromPhotos
    : fromPeriod;
}

/** Oldest first; undated milestones ride along after the milestone they follow in the manual order. */
export function orderChronologically<T extends Datable>(milestones: T[]): T[] {
  const manual = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  let anchor = Number.NEGATIVE_INFINITY;
  const keyed = manual.map((m, index) => {
    const date = milestoneSortDate(m);
    if (date !== null) anchor = date;
    // Dated: its own date. Undated: just after the dated milestone before it (manual index keeps ties stable).
    return { m, date: date ?? anchor, undated: date === null, index };
  });
  keyed.sort((a, b) => a.date - b.date || Number(a.undated) - Number(b.undated) || a.index - b.index);
  return keyed.map((k) => k.m);
}
