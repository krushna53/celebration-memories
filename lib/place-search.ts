/**
 * Free, key-free venue autocomplete for the Location fields in Event
 * Settings and the wizard's Event Details step
 * (components/forms/venue-autocomplete.tsx).
 *
 * Uses Komoot's Photon (https://photon.komoot.io) — an OpenStreetMap
 * search API built for search-as-you-type, with CORS enabled, so the
 * browser calls it directly. Deliberately not Google Places (needs a
 * billed API key — there's none anywhere in this project, same reasoning
 * as lib/maps.ts) and not Nominatim (its usage policy forbids
 * autocomplete; lib/timezone-lookup.ts still uses it for one-off
 * geocoding). Callers debounce and abort stale requests to stay within
 * Photon's fair-use expectations.
 */

export interface PlaceSuggestion {
  id: string;
  /** The place's own name (e.g. "Taj Lands End"), or the street line when it has none. */
  name: string;
  /** Everything after the name on one line — street, area, city, state, postcode, country. */
  address: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function toSuggestion(feature: PhotonFeature): PlaceSuggestion | null {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const name = p.name || street;
  if (!name) return null;

  const parts = [street !== name ? street : null, p.locality, p.district, p.city ?? p.county, p.state, p.postcode, p.country];
  // Drop blanks and repeats (Photon often reports the same area as both locality and district).
  const address = parts
    .filter((part): part is string => Boolean(part) && part !== name)
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(", ");

  return { id: `${p.osm_type ?? ""}${p.osm_id ?? `${lat},${lon}`}`, name, address, lat, lon };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);
  const data = (await response.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  return (data.features ?? [])
    .map(toSuggestion)
    .filter((s): s is PlaceSuggestion => {
      if (!s) return false;
      const key = `${s.name}|${s.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The single line used for the Address field and the Maps links — "Name, street, city, ...". */
export function placeFullAddress(place: PlaceSuggestion): string {
  return [place.name, place.address].filter(Boolean).join(", ");
}

/**
 * IANA timezone at the picked coordinates, resolved offline with the
 * same `tz-lookup` dataset lib/timezone-lookup.ts uses server-side —
 * loaded lazily so the ~70KB table only downloads once someone actually
 * picks a place. Null (never throws) on any failure.
 */
export async function timezoneForPlace(place: PlaceSuggestion): Promise<string | null> {
  try {
    const { default: tzlookup } = await import("tz-lookup");
    return tzlookup(place.lat, place.lon);
  } catch {
    return null;
  }
}
