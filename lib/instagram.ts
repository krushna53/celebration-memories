/**
 * Instagram link handling for "Share an Instagram post". Only public
 * post / reel / IGTV links are accepted, normalised to Instagram's
 * canonical permalink (tracking params, profile paths and share junk
 * stripped) so the same post can't be added twice under different URLs.
 * Shared by the client form (instant validation/preview) and the server
 * action (the real check).
 */

export interface InstagramLink {
  permalink: string;
  shortcode: string;
  kind: "post" | "reel" | "tv";
}

const HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am", "www.instagr.am"]);

export function parseInstagramUrl(raw: string): InstagramLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  // /p/{code}, /reel/{code}, /reels/{code}, /tv/{code} — optionally after a /{username}/ prefix.
  const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
  if (!match) return null;
  const kind = match[1] === "p" ? "post" : match[1] === "tv" ? "tv" : "reel";
  const segment = kind === "post" ? "p" : kind === "tv" ? "tv" : "reel";
  const shortcode = match[2]!;
  return { permalink: `https://www.instagram.com/${segment}/${shortcode}/`, shortcode, kind };
}
