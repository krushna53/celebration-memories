import { NextResponse, type NextRequest } from "next/server";

import { verifyMediaLink } from "@/lib/media-url";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Serves files from the private Storage buckets behind a signed, expiring
 * link (lib/media-url.ts). Two strategies, by file type:
 *
 * - Images are streamed through this route. That keeps the link on our
 *   domain for the image optimizer (locally, and Netlify's Image CDN in
 *   production) and lets the CDN cache each signed link until it expires.
 * - Video and audio redirect to a short-lived Supabase signed URL instead,
 *   so large files and seeking (Range requests) go straight to Storage and
 *   never through a serverless function.
 */

const VIDEO_AUDIO = /\.(mp4|mov|m4v|webm|mp3|m4a|aac|wav|ogg|oga)$/i;
const MAX_STREAMED_BYTES = 5 * 1024 * 1024;

// Signed Supabase URLs for video/audio, reused until shortly before they
// expire — one Storage API call per file per warm function instance
// rather than one per play.
const signedUrlCache = new Map<string, { url: string; validUntil: number }>();

function deny(status: number) {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path: segments } = await params;
  const path = segments.map((s) => decodeURIComponent(s)).join("/");
  const search = request.nextUrl.searchParams;

  const check = verifyMediaLink(bucket, path, search.get("e"), search.get("s"));
  if (!check.ok) return deny(check.reason === "expired" ? 410 : 404);

  const secondsLeft = Math.max(0, check.expiresAt - Math.floor(Date.now() / 1000));
  const cacheControl = `public, max-age=${secondsLeft}, s-maxage=${secondsLeft}, immutable`;

  const redirectToStorage = async () => {
    const key = `${bucket}/${path}:${check.expiresAt}`;
    const cached = signedUrlCache.get(key);
    let target = cached && cached.validUntil > Date.now() ? cached.url : null;
    if (!target) {
      // Outlive the /media link itself so a browser that cached the
      // redirect never lands on an already-expired Storage URL.
      const ttl = secondsLeft + 600;
      const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, ttl);
      if (error || !data) return deny(404);
      target = data.signedUrl;
      signedUrlCache.set(key, { url: target, validUntil: Date.now() + (ttl - 300) * 1000 });
      if (signedUrlCache.size > 5000) signedUrlCache.clear();
    }
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": cacheControl } });
  };

  if (VIDEO_AUDIO.test(path)) return redirectToStorage();

  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) return deny(404);
  // Serverless responses are size-capped on Netlify; the rare very large
  // original goes straight to Storage like a video does.
  if (data.size > MAX_STREAMED_BYTES) return redirectToStorage();

  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Length": String(data.size),
      "Content-Disposition": "inline",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
