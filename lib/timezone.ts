/**
 * Every event's date/time is stored as a real UTC instant (Postgres
 * timestamptz), but was originally displayed and edited using whatever
 * timezone happened to be ambient at render time — `date-fns`'s
 * `format(new Date(iso), ...)` renders in the *server's* local zone
 * (Netlify defaults to UTC), while the admin's datetime-local input
 * round-tripped through the *browser's* local zone. Neither was pinned
 * to the event's actual timezone, so an event entered as "11:00 AM"
 * could display as "5:30 AM" depending on where it was rendered.
 *
 * Every function here now takes the event's own IANA timezone (see
 * types/event.ts's `timezone` field, auto-detected from venueAddress by
 * lib/timezone-lookup.ts) and defaults to DEFAULT_EVENT_TIMEZONE only
 * for events that predate that field or have no venue address yet —
 * this used to be a single hardcoded India-only constant.
 *
 * The zoned<->UTC conversions use the "round-trip through
 * Intl.DateTimeFormat" technique rather than a timezone-database
 * library like `date-fns-tz`: format a guess instant in the target zone,
 * measure how far the result drifted from what was typed, and correct
 * by that drift. This is DST-safe for any IANA zone using only the
 * ICU timezone data already built into Node/browsers, no extra
 * dependency needed for the date math itself (a separate dependency,
 * `tz-lookup`, is used only for coordinate -> zone name lookup — see
 * lib/timezone-lookup.ts).
 */

export const DEFAULT_EVENT_TIMEZONE = "Asia/Kolkata";
/** @deprecated Use DEFAULT_EVENT_TIMEZONE — kept as an alias so any lingering import doesn't break. */
export const EVENT_TIMEZONE = DEFAULT_EVENT_TIMEZONE;

/** e.g. "Sunday, August 23, 2026" — in the given event timezone, regardless of server/browser timezone. */
export function formatEventDate(iso: string, timezone: string = DEFAULT_EVENT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * e.g. "11:00 AM GMT+5:30" (or "11:00 AM EDT" for zones with a common
 * short name) — in the given event timezone, regardless of server/
 * browser timezone. Always includes the zone so a guest anywhere in the
 * world sees, unambiguously, what time that is for them relative to the
 * venue — not just a bare clock time that reads as their own local time.
 */
export function formatEventTime(iso: string, timezone: string = DEFAULT_EVENT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date(iso));
}

/**
 * A pure calendar date (YYYY-MM-DD, no time-of-day — e.g.
 * events.occasion_date) formatted as "Month D, YYYY". Deliberately does
 * NOT take a timezone: a bare calendar date isn't an instant in time,
 * and running it through a timezone-aware instant formatter (like
 * formatEventDate) could shift it to the adjacent day depending on
 * which zone happens to format it — this always anchors to UTC noon
 * internally purely to get locale-aware month names, never letting any
 * ambient or event timezone touch the actual day number.
 */
export function formatCalendarDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Just the zone suffix on its own (e.g. "GMT+5:30", "EDT") — for labels that show a time without going through formatEventTime, like a countdown's "(India time)" caption. */
export function eventTimeZoneAbbreviation(iso: string, timezone: string = DEFAULT_EVENT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
}

/**
 * A stored UTC ISO instant, expressed as the value a
 * `<input type="datetime-local">` expects — using the instant's wall-
 * clock time in the given timezone, not the admin's browser's local time.
 */
export function utcIsoToZonedInputValue(iso: string, timezone: string = DEFAULT_EVENT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * The reverse — a `<input type="datetime-local">` value the admin typed,
 * intended as wall-clock time in the given timezone, converted to the
 * correct UTC ISO instant for storage.
 */
export function zonedInputValueToUtcIso(localValue: string, timezone: string = DEFAULT_EVENT_TIMEZONE): string {
  const [datePart = "", timePart = "00:00"] = localValue.split("T");
  const [year = 0, month = 1, day = 1] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);

  // First guess: treat the typed values as if they were already UTC.
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute);

  // Ask what wall-clock time that guess instant actually shows as in the
  // target zone, then measure the drift between that and what was
  // typed — the guess is off by exactly the zone's UTC offset (correctly
  // accounting for DST at that specific date, since Intl resolves it).
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guessUtcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Intl can report hour "24" for midnight in hour12: false — normalize to 0.
  const shownHour = get("hour") % 24;
  const shownAsUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), shownHour, get("minute"), get("second"));
  const driftMs = shownAsUtcMs - guessUtcMs;

  return new Date(guessUtcMs - driftMs).toISOString();
}

/** A reasonably short curated fallback for browsers without Intl.supportedValuesOf("timeZone") (older Safari). */
const FALLBACK_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "UTC",
];

/**
 * Every IANA timezone name the current runtime knows about, for the
 * admin's manual override <select>. Uses the browser/Node built-in
 * Intl.supportedValuesOf when available (all evergreen browsers, Node
 * 18+) rather than shipping a maintained list of our own; falls back to
 * a short curated list on anything older.
 */
export function listSupportedTimezones(): string[] {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    if (typeof intlWithSupportedValues.supportedValuesOf === "function") {
      return intlWithSupportedValues.supportedValuesOf("timeZone");
    }
  } catch {
    // fall through to the curated list
  }
  return FALLBACK_TIMEZONES;
}
