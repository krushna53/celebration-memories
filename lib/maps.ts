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
