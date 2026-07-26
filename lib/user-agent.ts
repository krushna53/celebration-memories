/**
 * Minimal, dependency-free user-agent parsing for invitation tracking.
 * Only needs to be "good enough" for admin-dashboard display (see
 * CLAUDE.md → Invitation Tracking) — not a full UA database. Per spec,
 * this never attempts to identify individual WhatsApp users; it only
 * reports coarse device/browser/OS categories.
 */
export interface ParsedUserAgent {
  device: string;
  browser: string;
  operatingSystem: string;
}

export function parseUserAgent(uaString: string | null): ParsedUserAgent {
  const ua = uaString ?? "";

  const device = /Mobi|Android/i.test(ua)
    ? /iPad|Tablet/i.test(ua)
      ? "Tablet"
      : "Mobile"
    : "Desktop";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/CriOS\//i.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS\//i.test(ua)) browser = "Firefox (iOS)";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  let operatingSystem = "Unknown";
  if (/Windows/i.test(ua)) operatingSystem = "Windows";
  else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua))
    operatingSystem = "macOS";
  else if (/iPhone|iPad|iPod/i.test(ua)) operatingSystem = "iOS";
  else if (/Android/i.test(ua)) operatingSystem = "Android";
  else if (/Linux/i.test(ua)) operatingSystem = "Linux";

  return { device, browser, operatingSystem };
}
