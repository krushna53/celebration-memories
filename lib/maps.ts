/**
 * Free, no-API-key Google Maps link generation from a plain address —
 * see features/admin/event-settings/event-settings-form.tsx's "Generate
 * from address" buttons next to the Maps Directions/Embed URL fields.
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

/** An iframe-embeddable Maps link (`…output=embed` or `/maps/embed…`) rather than a link meant to be opened. */
export function isMapsEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /[?&]output=embed\b/.test(url) || /\/maps\/embed\b/.test(url);
}

/**
 * Tidies the two saved Maps links for display. Hosts sometimes paste the
 * embed link into the Directions field and leave the Embed field empty —
 * the page then showed no map and "Get Directions" opened a bare embed
 * page. In that case the embed link is used for the map, and directions
 * become a normal Maps search for the same place (when it names one).
 */
export function resolveVenueMapLinks(
  mapsUrl: string | null,
  mapsEmbedUrl: string | null,
): { mapsUrl: string | null; mapsEmbedUrl: string | null } {
  const directionsIsEmbed = isMapsEmbedUrl(mapsUrl);
  const embed = mapsEmbedUrl || (directionsIsEmbed ? mapsUrl : null);
  if (!directionsIsEmbed) return { mapsUrl, mapsEmbedUrl: embed };

  let query: string | null = null;
  try {
    query = new URL(mapsUrl!).searchParams.get("q");
  } catch {
    query = null;
  }
  return { mapsUrl: query ? buildMapsSearchUrl(query) : mapsUrl, mapsEmbedUrl: embed };
}
