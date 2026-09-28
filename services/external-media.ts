import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isPrivateMediaBucket, parseMediaLink } from "@/lib/media-url";

/**
 * Links that leave our site — sent to OpenAI (AI captions), Shotstack or
 * HeyGen (video renders), or returned to the native mobile app — can't be
 * relative `/media/...` paths, and in local dev they can't point at
 * localhost either. They get a direct Supabase signed URL instead, valid
 * for `ttlSeconds` (default 24h, long enough for a slow render queue).
 */
export async function externalMediaUrl(bucket: string, path: string, ttlSeconds = 24 * 60 * 60): Promise<string> {
  const client = supabaseAdmin().storage.from(bucket);
  if (!isPrivateMediaBucket(bucket)) return client.getPublicUrl(path).data.publicUrl;

  const { data, error } = await client.createSignedUrl(path, ttlSeconds);
  if (error || !data) throw new Error(`Couldn't create a link for that file: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

/**
 * Same as externalMediaUrl, starting from a link a page already has (a
 * signed `/media/...` link or a legacy public Storage URL). The signature
 * must be genuine, so a caller can't swap in someone else's file.
 * `allowExpired` is only for server code that has already checked the
 * caller is an admin (e.g. re-rendering a saved video-editor project);
 * anything reachable without that check leaves it off. Non-storage links
 * (e.g. YouTube) come back unchanged.
 */
export async function externalizeMediaLink(
  url: string,
  options: { ttlSeconds?: number; allowExpired?: boolean } = {},
): Promise<string> {
  const ref = parseMediaLink(url, { allowExpired: options.allowExpired ?? false });
  if (!ref) {
    if (url.startsWith("/media/")) throw new Error("That media link isn't valid.");
    return url;
  }
  return externalMediaUrl(ref.bucket, ref.path, options.ttlSeconds);
}

/** Replaces every media link found anywhere inside a JSON value (e.g. a Shotstack edit), leaving everything else untouched. */
export async function externalizeMediaLinksDeep<T>(value: T, options: { allowExpired?: boolean } = {}): Promise<T> {
  if (typeof value === "string") {
    return (parseMediaLink(value, { allowExpired: options.allowExpired }) || value.startsWith("/media/")
      ? await externalizeMediaLink(value, options)
      : value) as T;
  }
  if (Array.isArray(value)) {
    return (await Promise.all(value.map((v) => externalizeMediaLinksDeep(v, options)))) as T;
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await externalizeMediaLinksDeep(v, options)] as const),
    );
    return Object.fromEntries(entries) as T;
  }
  return value;
}
