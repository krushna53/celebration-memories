import "server-only";
import { createHash } from "node:crypto";

/**
 * Extracts the caller's IP from a Next.js Request, preferring Netlify's
 * own trusted header — `x-nf-client-connection-ip` is set by Netlify's
 * edge from the actual TCP connection and can't be spoofed by the
 * client, unlike `x-forwarded-for`/`x-real-ip`, which any caller can
 * set to anything. Falls back to x-forwarded-for's first hop for local
 * dev (`netlify dev`) and any other environment without that header.
 * Used only for the public AI Image tool's rate limiting
 * (app/api/public-ai-image/route.ts) — nowhere else in this app tracks
 * IP addresses.
 */
export function getClientIp(req: Request): string {
  const nfIp = req.headers.get("x-nf-client-connection-ip");
  if (nfIp) return nfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

/** One-way hash so the rate-limit table never stores a raw, personally-identifying IP address — salted with a server-only secret (falls back to a fixed string in dev/if unset, which is fine since this table is bookkeeping only, not a security boundary). */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "everymoment-public-ai-image-tool";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
