/**
 * Turns whatever URL the owner pastes for the platform's "See It In
 * Action" feature video (see supabase/migrations/0043_platform_feature_
 * video.sql) into either an embeddable iframe src (YouTube/Vimeo) or a
 * direct file URL for a plain <video> tag (anything else — including an
 * uploaded file's own Storage URL, which always goes this path). Same
 * "admin pastes ordinary share links, this file translates" idea as
 * lib/live-stream.ts's parseLiveStreamUrl, just for a different pair of
 * platforms.
 *
 * Framework-agnostic (no "server-only"/"use client") so it can run in
 * both the admin form's live preview and the public section.
 */

export type FeatureVideoPlatform = "youtube" | "vimeo" | "direct";

export interface ParsedFeatureVideo {
  platform: FeatureVideoPlatform;
  /** Ready to drop into an <iframe src> — only set for youtube/vimeo. */
  embedUrl: string | null;
  /** Ready to drop into a <video src> — only set for "direct". */
  directUrl: string | null;
}

function extractYouTubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    return id || null;
  }
  if (url.hostname.endsWith("youtube.com")) {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    if (url.pathname.startsWith("/live/")) return url.pathname.split("/")[2] || null;
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || null;
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
  }
  return null;
}

function extractVimeoId(url: URL): string | null {
  // vimeo.com/123456789, vimeo.com/channels/x/123456789, or player.vimeo.com/video/123456789
  const match = url.pathname.match(/(\d{6,})/);
  return match?.[1] ?? null;
}

/** For source_type = "link" — figures out whether the pasted URL is YouTube, Vimeo, or a direct file link. */
export function parseFeatureVideoUrl(rawUrl: string | null | undefined): ParsedFeatureVideo {
  if (!rawUrl?.trim()) return { platform: "direct", embedUrl: null, directUrl: null };

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { platform: "direct", embedUrl: null, directUrl: null };
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const videoId = extractYouTubeId(url);
    if (!videoId) return { platform: "youtube", embedUrl: null, directUrl: null };
    return { platform: "youtube", embedUrl: `https://www.youtube.com/embed/${videoId}`, directUrl: null };
  }

  if (host.endsWith("vimeo.com")) {
    const videoId = extractVimeoId(url);
    if (!videoId) return { platform: "vimeo", embedUrl: null, directUrl: null };
    return { platform: "vimeo", embedUrl: `https://player.vimeo.com/video/${videoId}`, directUrl: null };
  }

  // Anything else — a direct file link, or (always, for source_type =
  // "upload") the uploaded file's own Storage URL — rendered with a
  // native <video> tag instead of an iframe.
  return { platform: "direct", embedUrl: null, directUrl: url.toString() };
}
