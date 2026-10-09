import type { NextConfig } from "next";

/**
 * Baseline security headers on every response.
 * - Referrer-Policy matters most here: guest invite links carry their token
 *   in the path (/invite/7FQ2KD91), and without it the full URL would be
 *   sent to every third party a page links to or embeds (Maps, YouTube…).
 * - frame-ancestors 'self' stops other sites framing our pages (clickjacking)
 *   while keeping our own template-preview iframe working.
 * - Camera/microphone stay allowed for our own origin (in-browser video,
 *   audio and voice recording); geolocation, USB and similar are off.
 * - A full script/style CSP is deliberately not set yet: the site loads
 *   Clarity, Google, Instagram, Stripe, Razorpay and YouTube, and a too-strict
 *   policy would break payments or embeds without warning.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), usb=(), serial=(), bluetooth=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS },
      ...["events", "invite", "event-day", "session", "share", "games", "plan", "reels", "p", "media", "event-access", "admin", "api/mobile", "api/support-access"].map(route => ({ source: `/${route}/:path*`, headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Netlify-CDN-Cache-Control", value: "no-store" },
      ] })),
    ];
  },
  images: {
    // Protected images need the viewer session; shared optimization strips it.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    // Signed private-media links (lib/media-url.ts) carry their expiry and
    // signature in the query string; every other local image has none.
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/**", search: "" }],
  },
};

export default nextConfig;
