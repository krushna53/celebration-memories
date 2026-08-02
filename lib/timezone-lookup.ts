import "server-only";
import tzlookup from "tz-lookup";

/**
 * Derives an IANA timezone (e.g. "America/New_York") from a free-text
 * venue address — used to auto-populate events.timezone whenever an
 * admin saves a venue address (see features/admin/event-settings's
 * detectEventTimezoneAction), so every displayed time is pinned to the
 * venue's own local time rather than a hardcoded default.
 *
 * Deliberately free and key-free, matching this project's existing
 * lib/maps.ts convention of avoiding a paid Google Maps API key:
 *  1. Geocode the address to lat/lng via OpenStreetMap's Nominatim
 *     (free, no signup — but rate-limited and requires a descriptive
 *     User-Agent per their usage policy: https://operations.osmfoundation.org/policies/nominatim/).
 *     This only runs when an admin actually saves a venue address, not
 *     on every page view, so it stays well within Nominatim's limits.
 *  2. Resolve lat/lng to an IANA zone entirely offline via the
 *     `tz-lookup` package (a bundled polygon dataset) — no second
 *     network call, no timezone API key needed at all.
 *
 * Returns null (never throws) on any failure — geocoding is a best-
 * effort convenience, not something that should ever block saving an
 * event's other details. Callers should keep whatever timezone was set
 * before if this returns null.
 */
export async function resolveTimezoneFromAddress(address: string): Promise<string | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires an identifying User-Agent —
        // generic fetch clients get blocked without one.
        "User-Agent": "CelebrationMemories/1.0 (event venue timezone lookup)",
      },
    });
    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return tzlookup(lat, lon);
  } catch (err) {
    console.error("resolveTimezoneFromAddress failed:", err);
    return null;
  }
}
