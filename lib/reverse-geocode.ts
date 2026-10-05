import "server-only";

/**
 * GPS coordinates → a short, human place name ("Lonavala, Maharashtra"),
 * for photos whose EXIF carries a location (lib/photo-metadata.ts).
 *
 * Free and key-free via OpenStreetMap Nominatim's reverse endpoint, same
 * provider and User-Agent convention as lib/timezone-lookup.ts. Runs
 * server-side, once per photo a host actually adds, which stays well
 * inside Nominatim's usage policy. Returns null (never throws) on any
 * failure — a missing place name should never block an upload.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", lat.toFixed(5));
    url.searchParams.set("lon", lon.toFixed(5));
    url.searchParams.set("format", "jsonv2");
    // ~town/suburb level: specific enough to be meaningful, never a street address.
    url.searchParams.set("zoom", "12");
    url.searchParams.set("accept-language", "en");

    const response = await fetch(url, {
      headers: { "User-Agent": "CelebrationMemories/1.0 (photo place lookup)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    const locality = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? data.name;
    const region = a.state ?? a.country;
    const parts = [locality, region && region !== locality ? region : null].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch (err) {
    console.error("reverseGeocode failed:", err);
    return null;
  }
}
