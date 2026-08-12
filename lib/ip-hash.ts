import "server-only";
import { createHash } from "node:crypto";

/**
 * Extracts the caller's IP from a headers-like object, preferring
 * Netlify's own trusted header — `x-nf-client-connection-ip` is set by
 * Netlify's edge from the actual TCP connection and can't be spoofed by
 * the client, unlike `x-forwarded-for`/`x-real-ip`, which any caller
 * can set to anything. Falls back to x-forwarded-for's first hop for
 * local dev (`netlify dev`) and any other environment without that
 * header.
 *
 * Takes a plain `{ get(name): string | null }` rather than a full
 * `Request` so the same function works from both a Route Handler
 * (`request.headers`, e.g. app/api/public-ai-image/route.ts) and a
 * Server Action (`headers()` from "next/headers", e.g.
 * features/forms/actions.ts's public form submission) — Next's
 * `ReadonlyHeaders` implements the same `.get()` shape as `Headers`.
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const nfIp = headers.get("x-nf-client-connection-ip");
  if (nfIp) return nfIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

/** One-way hash so the rate-limit table never stores a raw, personally-identifying IP address — salted with a server-only secret (falls back to a fixed string in dev/if unset, which is fine since this table is bookkeeping only, not a security boundary). */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "everymoment-public-ai-image-tool";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
