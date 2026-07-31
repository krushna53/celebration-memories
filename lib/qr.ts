/**
 * QR code images via a public, no-API-key image endpoint
 * (api.qrserver.com) rather than a server-side generation library —
 * this project has no QR-generating dependency installed, and this
 * avoids adding one just to render a scannable code for a plain URL.
 * The browser fetches the image directly from the third party (nothing
 * routes through this app's own server), and the only data sent is the
 * link itself (a random share token, no guest PII) — an acceptable
 * trade-off for a party-game/planner QR code. Swap this for a
 * self-hosted generator later if that third-party dependency ever
 * becomes a concern.
 */
export function qrImageUrl(data: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
