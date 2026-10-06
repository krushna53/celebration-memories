/**
 * Free, no-API-key Google Maps link generation from a plain address —
 * the Location fields in Event Settings and the wizard fill these in
 * automatically from the venue name + address (hooks/use-auto-venue-maps.ts),
 * with "Regenerate" buttons to overwrite a pasted link.
 *
 * The reverse direction (an arbitrary Maps link -> a structured address)
 * is NOT implemented here — it needs Google's paid Places/Geocoding API
 * and doesn't reliably resolve shortened maps.app.goo.gl links either
 * way, so it's tracked as a separate TODO rather than attempted for free.
 */

/** A standard Maps "directions/search" link — opens the Google Maps app or website centered on the address. */
export function buildMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * An embeddable Maps URL usable directly in an <iframe src="...">
 * without a Google Maps API key. Uses the long-standing
 * maps.google.com/maps?output=embed pattern (unofficial but still
 * broadly functional) rather than the official Maps Embed API, which
 * requires a billed API key — consistent with keeping this feature free.
 */
export function buildMapsEmbedUrl(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

const SEARCH_PREFIX = "https://www.google.com/maps/search/?api=1&query=";
const EMBED_PREFIX = "https://maps.google.com/maps?q=";

/**
 * The text Google Maps searches for: venue name + address together
 * (the name alone is ambiguous, the address alone often lands on the
 * street rather than the venue). The name is skipped when the address
 * already contains it, e.g. "Supreme Deli, Ground floor, …".
 */
export function buildVenueQuery(venueName: string, venueAddress: string): string {
  const name = venueName.trim();
  const address = venueAddress.trim();
  if (!name) return address;
  if (!address) return name;
  return address.toLowerCase().includes(name.toLowerCase()) ? address : `${name}, ${address}`;
}

/** True for an empty link or one built by buildMapsSearchUrl — i.e. safe to regenerate without losing a link someone pasted by hand. */
export function isAutoMapsUrl(url: string): boolean {
  return !url.trim() || url.startsWith(SEARCH_PREFIX);
}

/** Same as isAutoMapsUrl, for buildMapsEmbedUrl links. */
export function isAutoMapsEmbedUrl(url: string): boolean {
  return !url.trim() || (url.startsWith(EMBED_PREFIX) && url.endsWith("&output=embed"));
}
