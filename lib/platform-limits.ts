/**
 * Supabase Pro plan quotas + overage rates, for the owner-only Platform
 * Utilization dashboard (/admin/platform-usage,
 * services/platform-capacity.ts). Hardcoded rather than fetched live —
 * plan/billing data lives in Supabase's Management API (organization
 * subscription, invoices), which isn't reachable from this app's normal
 * runtime (only from tooling with a Supabase personal access token,
 * outside this codebase). Confirmed against
 * https://supabase.com/pricing and
 * https://supabase.com/docs/guides/platform/compute-and-disk on
 * 2026-08-13 — re-check both pages if this ever looks stale, and treat
 * the dashboard's own **Settings → Billing → Usage** tab as the
 * authoritative source for what's actually being billed, same
 * "estimate, not invoice" caveat as lib/usage-pricing.ts.
 *
 * This project's organization is on Pro ($25/mo base) — confirmed via
 * the Supabase MCP's get_organization. If you ever move to Team or
 * Enterprise, update PLAN_NAME and the limits below to match.
 */
export const PLAN_NAME = "Pro";

export const PLATFORM_LIMITS = {
  /** Included database disk size, in bytes. Overage: $0.125/GB. */
  dbSizeBytes: 8 * 1024 * 1024 * 1024,
  dbOverageUsdPerGb: 0.125,

  /** Included Supabase Storage, in bytes. Overage: $0.0213/GB. */
  storageBytes: 100 * 1024 * 1024 * 1024,
  storageOverageUsdPerGb: 0.0213,

  /** Included Monthly Active Users. Overage: $0.00325/MAU. */
  mau: 100_000,
  mauOverageUsd: 0.00325,

  /** Included egress (bandwidth), in bytes/month. Overage: $0.09/GB. Not measured live by this app — see the dashboard's Usage tab for the real number. */
  egressBytes: 250 * 1024 * 1024 * 1024,
  egressOverageUsdPerGb: 0.09,
} as const;

export interface ComputeTierSpec {
  name: string;
  monthlyUsd: number;
  ramGb: number;
  maxConnections: number;
  maxPoolerClients: number;
  recommendedMaxDbGb: number;
}

/**
 * The two smallest compute tiers only — enough to explain this
 * project's current situation without reproducing Supabase's entire
 * pricing table. See https://supabase.com/docs/guides/platform/compute-and-disk
 * for the full ladder (Small through 16XL) if this project ever
 * outgrows Micro.
 */
export const COMPUTE_TIERS: Record<"nano" | "micro", ComputeTierSpec> = {
  nano: { name: "Nano", monthlyUsd: 0, ramGb: 0.5, maxConnections: 60, maxPoolerClients: 200, recommendedMaxDbGb: 0.5 },
  micro: { name: "Micro", monthlyUsd: 10, ramGb: 1, maxConnections: 60, maxPoolerClients: 200, recommendedMaxDbGb: 10 },
};

/** For formatting bytes, use lib/format-bytes.ts's formatBytes — kept in one place rather than duplicated here. */
export function percentOfLimit(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (used / limit) * 100);
}
