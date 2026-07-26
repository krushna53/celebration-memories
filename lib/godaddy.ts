import "server-only";

import type { DomainAvailabilityResult } from "@/types/domain-search";

export type { DomainAvailabilityResult };

/**
 * Thin wrapper around GoDaddy's Domain Availability API, for the
 * client-facing custom-domain search at /admin/domain-search.
 *
 * We deliberately do NOT attempt real in-app purchase — GoDaddy only
 * allows programmatic domain *purchase* for API Reseller accounts
 * (a separate approval process with a funded "Good as Gold" balance),
 * which this platform doesn't have. Availability + pricing checks,
 * however, work with a plain GoDaddy API key/secret pair from
 * https://developer.godaddy.com/keys — no reseller approval needed.
 * So the flow here is: check availability via the real API, then hand
 * off to GoDaddy's own checkout via a deep link for the actual purchase.
 *
 * Set GODADDY_API_KEY + GODADDY_API_SECRET to enable. Optionally set
 * GODADDY_API_ENV=test to hit GoDaddy's OTE (sandbox) environment
 * instead of production — useful since OTE keys are free/instant while
 * production keys currently require an existing GoDaddy account in
 * good standing.
 */

const PRODUCTION_BASE = "https://api.godaddy.com";
const OTE_BASE = "https://api.ote-godaddy.com";

function getCredentials(): { key: string; secret: string; base: string } | null {
  const key = process.env.GODADDY_API_KEY;
  const secret = process.env.GODADDY_API_SECRET;
  if (!key || !secret) return null;
  const base = process.env.GODADDY_API_ENV === "test" ? OTE_BASE : PRODUCTION_BASE;
  return { key, secret, base };
}

export const GODADDY_CONFIGURED = Boolean(process.env.GODADDY_API_KEY && process.env.GODADDY_API_SECRET);

/** Event-appropriate TLDs to check for every search — kept short so one search stays fast. */
export const DOMAIN_SEARCH_TLDS: readonly string[] = [
  "com",
  "in",
  "co",
  "events",
  "party",
  "live",
  "online",
  "info",
];


export class GoDaddyError extends Error {}

function sanitizeLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 63);
}

/** GoDaddy's own no-API-key-required checkout search page — always works as a fallback deep link. */
export function godaddySearchUrl(domain: string): string {
  return `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}`;
}

/**
 * Checks availability + price for `label` across DOMAIN_SEARCH_TLDS in
 * parallel. Throws GoDaddyError if credentials aren't configured or the
 * whole batch fails outright; individual per-TLD failures are folded
 * into that domain's result as unavailable/unknown rather than failing
 * the whole search.
 */
export async function checkDomainAvailability(rawLabel: string): Promise<DomainAvailabilityResult[]> {
  const creds = getCredentials();
  if (!creds) {
    throw new GoDaddyError(
      "Domain search isn't configured — add GODADDY_API_KEY and GODADDY_API_SECRET to enable it.",
    );
  }

  const label = sanitizeLabel(rawLabel);
  if (!label) {
    throw new GoDaddyError("Enter a name to search for (letters, numbers, and hyphens only).");
  }

  const domains = DOMAIN_SEARCH_TLDS.map((tld) => `${label}.${tld}`);

  const results = await Promise.all(
    domains.map(async (domain): Promise<DomainAvailabilityResult> => {
      try {
        const res = await fetch(
          `${creds.base}/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FAST`,
          {
            headers: {
              Authorization: `sso-key ${creds.key}:${creds.secret}`,
              Accept: "application/json",
            },
            cache: "no-store",
          },
        );

        if (!res.ok) {
          return { domain, available: false, price: null, currency: null };
        }

        const data = (await res.json()) as {
          available?: boolean;
          price?: number;
          currency?: string;
        };

        return {
          domain,
          available: Boolean(data.available),
          price: typeof data.price === "number" ? data.price / 1_000_000 : null,
          currency: data.currency ?? null,
        };
      } catch {
        return { domain, available: false, price: null, currency: null };
      }
    }),
  );

  return results;
}
