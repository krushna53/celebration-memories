/**
 * Turns whatever URL an admin pastes for YouTube Live / Facebook Live
 * (#72's "simple embed" tier — see migration 0042_live_stream_embed.sql
 * for why this tier over a full self-hosted RTMP/HLS server) into an
 * actual embeddable iframe src. Admins paste ordinary share/watch links
 * (youtube.com/watch?v=..., youtu.be/..., facebook.com/.../videos/...),
 * not embed URLs — this is the one place that translates between them,
 * so features/live-stream/live-stream-section.tsx never has to care
 * about the difference.
 *
 * Framework-agnostic (no "server-only"/"use client") so it can run in
 * both the admin form's live preview and the public section — pure
 * string parsing, no I/O.
 */

export type LiveStreamPlatform = "youtube" | "facebook" | "unknown";

export interface ParsedLiveStream {
  platform: LiveStreamPlatform;
  /** Ready to drop straight into an <iframe src>. Null if the URL couldn't be parsed into an embeddable form. */
  embedUrl: string | null;
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
  }
  return null;
}

export function parseLiveStreamUrl(rawUrl: string | null | undefined): ParsedLiveStream {
  if (!rawUrl?.trim()) return { platform: "unknown", embedUrl: null };

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { platform: "unknown", embedUrl: null };
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const videoId = extractYouTubeId(url);
    if (!videoId) return { platform: "youtube", embedUrl: null };
    return { platform: "youtube", embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0` };
  }

  if (host.endsWith("facebook.com") || host === "fb.watch") {
    // Facebook's own embed pattern wraps the *original* share URL rather
    // than extracting a video id — https://developers.facebook.com/docs/plugins/embedded-video-player
    return {
      platform: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false`,
    };
  }

  return { platform: "unknown", embedUrl: null };
}
