/**
 * Every event's date/time is stored as a real UTC instant (Postgres
 * timestamptz), but was being displayed and edited using whatever
 * timezone happened to be ambient at render time — `date-fns`'s
 * `format(new Date(iso), ...)` renders in the *server's* local zone
 * (Netlify defaults to UTC), while the admin's datetime-local input
 * round-tripped through the *browser's* local zone. Neither was pinned
 * to the event's actual timezone, so an event entered as "11:00 AM"
 * could display as "5:30 AM" depending on where it was rendered.
 *
 * Every event on this platform today is India-based, so everything here
 * is pinned to India Standard Time. IST has a fixed +05:30 offset with
 * no DST, which is what makes istInputValueToUtcIso/utcIsoToIstInputValue's
 * plain arithmetic exact without needing a timezone-database dependency
 * (like `date-fns-tz`, which isn't installed). If this platform later
 * supports events outside India, this file is the one place that needs
 * to grow a per-event timezone field.
 */

export const EVENT_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** e.g. "Sunday, August 23, 2026" — always in IST, regardless of server timezone. */
export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/** e.g. "11:00 AM" — always in IST, regardless of server timezone. */
export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/**
 * A stored UTC ISO instant, expressed as the value a
 * `<input type="datetime-local">` expects — using the instant's IST
 * wall-clock time, not the admin's browser's local time.
 */
export function utcIsoToIstInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_TIMEZONE,
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
 * intended as IST wall-clock time, converted to the correct UTC ISO
 * instant for storage. Deliberately does its own Date.UTC arithmetic
 * rather than `new Date(localValue).toISOString()`, which would parse
 * the string using the browser's ambient local timezone instead of IST.
 */
export function istInputValueToUtcIso(localValue: string): string {
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}
