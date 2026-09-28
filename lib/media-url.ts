import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring links for files in the PRIVATE Storage buckets.
 *
 * Guest memories (photos/videos/audio) and the family gallery used to be
 * served straight from public buckets, so any copied link worked forever
 * for anyone. These buckets are now private; pages get a link on our own
 * domain instead — `/media/<bucket>/<path>?e=<expiry>&s=<signature>` —
 * which app/media/[bucket]/[...path]/route.ts verifies before serving the
 * file. A copied link stops working after it expires, and a link can't be
 * forged or pointed at another file without MEDIA_URL_SECRET.
 *
 * Expiry is rounded to fixed windows so the same file gets the SAME link
 * for a few hours — browsers, Netlify's CDN and the image optimizer can
 * all cache it — instead of a new link on every render. A link is valid
 * for between LINK_WINDOW_SECONDS and 2× that, depending on when in the
 * window it was issued.
 *
 * Kept synchronous on purpose: publicMediaUrl() (services/uploads.ts) is
 * called from ~90 places while mapping DB rows, and signing locally with
 * an HMAC needs no network round-trip, unlike Supabase's createSignedUrl.
 */
export const PRIVATE_MEDIA_BUCKETS = ["photos", "videos", "audio", "gallery"] as const;
export type PrivateMediaBucket = (typeof PRIVATE_MEDIA_BUCKETS)[number];

export const LINK_WINDOW_SECONDS = 6 * 60 * 60;

export function isPrivateMediaBucket(bucket: string): bucket is PrivateMediaBucket {
  return (PRIVATE_MEDIA_BUCKETS as readonly string[]).includes(bucket);
}

let cachedSecret: string | null = null;

/**
 * MEDIA_URL_SECRET if set; otherwise a key derived from the Supabase
 * service-role key (already a server-only secret in every environment),
 * so signing works without extra setup. Setting MEDIA_URL_SECRET later —
 * or rotating the service-role key — just re-issues every link on the
 * next page render.
 */
function mediaSecret(): string {
  if (cachedSecret) return cachedSecret;
  const explicit = process.env.MEDIA_URL_SECRET;
  if (explicit && explicit.length >= 32) return (cachedSecret = explicit);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Neither MEDIA_URL_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set.");
  return (cachedSecret = createHmac("sha256", serviceKey).update("everymoment:media-url:v1").digest("base64url"));
}

function sign(bucket: string, path: string, expiresAt: number): string {
  return createHmac("sha256", mediaSecret())
    .update(`${bucket}/${path}:${expiresAt}`)
    .digest("base64url")
    .slice(0, 32);
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Relative, signed `/media/...` link for a file in a private bucket. */
export function signedMediaPath(bucket: PrivateMediaBucket, path: string, nowMs = Date.now()): string {
  const nowSec = Math.floor(nowMs / 1000);
  const expiresAt = (Math.floor(nowSec / LINK_WINDOW_SECONDS) + 2) * LINK_WINDOW_SECONDS;
  return `/media/${bucket}/${encodePath(path)}?e=${expiresAt}&s=${sign(bucket, path, expiresAt)}`;
}

export type MediaLinkCheck =
  | { ok: true; bucket: PrivateMediaBucket; path: string; expiresAt: number }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Verifies a signed media link. `allowExpired` is only for server-side
 * callers re-using a link an admin was legitimately given earlier (e.g. a
 * saved video-editor project being re-rendered) — the signature still has
 * to be genuine.
 */
export function verifyMediaLink(
  bucket: string,
  path: string,
  expiresAtRaw: string | null,
  signature: string | null,
  options: { allowExpired?: boolean; nowMs?: number } = {},
): MediaLinkCheck {
  if (!isPrivateMediaBucket(bucket) || !path || path.includes("..") || !expiresAtRaw || !signature) {
    return { ok: false, reason: "malformed" };
  }
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt)) return { ok: false, reason: "malformed" };

  const expected = Buffer.from(sign(bucket, path, expiresAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad-signature" };
  }
  if (!options.allowExpired && expiresAt * 1000 <= (options.nowMs ?? Date.now())) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, bucket, path, expiresAt };
}

/**
 * Re-issues fresh `/media/...` links for every media link inside a saved
 * JSON value (a video-editor project saved days ago still references the
 * links it was built with). Genuine-but-expired signed links and legacy
 * public URLs to private buckets both come back as current signed links;
 * anything else is untouched. Server-side admin views only — it accepts
 * expired signatures.
 */
export function refreshMediaLinksDeep<T>(value: T): T {
  if (typeof value === "string") {
    const ref = value.includes("/media/") || value.includes("/object/public/") ? parseMediaLink(value, { allowExpired: true }) : null;
    return (ref && isPrivateMediaBucket(ref.bucket) ? signedMediaPath(ref.bucket, ref.path) : value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => refreshMediaLinksDeep(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, refreshMediaLinksDeep(v)])) as T;
  }
  return value;
}

/** Makes every relative `/media/...` link inside a JSON value absolute against `origin` — for API responses read by the native mobile app, which has no page URL to resolve relative links against. */
export function absolutizeMediaLinksDeep<T>(value: T, origin: string): T {
  if (typeof value === "string") return (value.startsWith("/media/") ? new URL(value, origin).toString() : value) as T;
  if (Array.isArray(value)) return value.map((v) => absolutizeMediaLinksDeep(v, origin)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutizeMediaLinksDeep(v, origin)])) as T;
  }
  return value;
}

/**
 * Pulls bucket + path out of either a signed `/media/...` link (relative or
 * absolute) or a legacy public Storage URL, verifying the signature for the
 * former. Returns null for anything else (YouTube links, other sites, a
 * tampered link). Used where a link has to leave our domain — see
 * services/external-media.ts.
 */
export function parseMediaLink(
  url: string,
  options: { allowExpired?: boolean } = {},
): { bucket: string; path: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://local");
  } catch {
    return null;
  }

  const media = parsed.pathname.match(/^\/media\/([a-z-]+)\/(.+)$/);
  if (media) {
    const bucket = media[1]!;
    const path = media[2]!.split("/").map(decodeURIComponent).join("/");
    const check = verifyMediaLink(bucket, path, parsed.searchParams.get("e"), parsed.searchParams.get("s"), options);
    return check.ok ? { bucket: check.bucket, path: check.path } : null;
  }

  const legacy = parsed.pathname.match(/\/storage\/v1\/object\/public\/([a-z-]+)\/(.+)$/);
  if (legacy) {
    return { bucket: legacy[1]!, path: legacy[2]!.split("/").map(decodeURIComponent).join("/") };
  }
  return null;
}
