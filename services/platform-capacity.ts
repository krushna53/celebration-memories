import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLATFORM_LIMITS, COMPUTE_TIERS, PLAN_NAME } from "@/lib/platform-limits";

/**
 * Live Supabase plan capacity vs actual usage, for the owner-only
 * Platform Utilization dashboard (/admin/platform-usage). Real numbers
 * pulled via the three RPCs in migration
 * 0053_platform_capacity_stats.sql (system-catalog data the normal
 * PostgREST table API can't reach); the *limits* they're compared
 * against are hardcoded plan constants (lib/platform-limits.ts) since
 * billing/subscription data isn't reachable from this app's runtime.
 */
export interface PlatformCapacitySnapshot {
  planName: string;
  dbSizeBytes: number;
  storageBytes: number;
  storageByBucket: { bucketId: string; objectCount: number; totalBytes: number }[];
  totalUsers: number;
  activeUsers28d: number;
  /**
   * True when the project is still running Nano compute despite being
   * on a paid plan — Supabase bills Nano at the same price as Micro on
   * paid orgs but doesn't auto-upgrade it (avoids the brief downtime a
   * compute change causes), so this is a real, actionable "you're
   * already paying for this, might as well claim it" flag rather than
   * a hypothetical recommendation. See migration 0053's header comment
   * and https://supabase.com/docs/guides/platform/compute-and-disk.
   */
  isOnNanoComputeUnderPaidPlan: boolean;
}

function emptySnapshot(): PlatformCapacitySnapshot {
  return {
    planName: PLAN_NAME,
    dbSizeBytes: 0,
    storageBytes: 0,
    storageByBucket: [],
    totalUsers: 0,
    activeUsers28d: 0,
    isOnNanoComputeUnderPaidPlan: false,
  };
}

export async function getPlatformCapacitySnapshot(): Promise<PlatformCapacitySnapshot> {
  const admin = supabaseAdmin();

  const [dbSizeResult, storageResult, authStatsResult] = await Promise.all([
    admin.rpc("platform_db_size_bytes"),
    admin.rpc("platform_storage_usage"),
    admin.rpc("platform_auth_user_stats"),
  ]);

  if (dbSizeResult.error) console.error("getPlatformCapacitySnapshot: platform_db_size_bytes failed:", dbSizeResult.error.message);
  if (storageResult.error) console.error("getPlatformCapacitySnapshot: platform_storage_usage failed:", storageResult.error.message);
  if (authStatsResult.error) console.error("getPlatformCapacitySnapshot: platform_auth_user_stats failed:", authStatsResult.error.message);

  if (dbSizeResult.error || storageResult.error || authStatsResult.error) {
    return emptySnapshot();
  }

  const storageByBucket = (storageResult.data as { bucket_id: string; object_count: number; total_bytes: number }[] | null ?? []).map(
    (row) => ({ bucketId: row.bucket_id, objectCount: row.object_count, totalBytes: row.total_bytes }),
  );
  const storageBytes = storageByBucket.reduce((sum, b) => sum + b.totalBytes, 0);

  const authStats = (authStatsResult.data as { total_users: number; active_28d: number }[] | null)?.[0];

  return {
    planName: PLAN_NAME,
    dbSizeBytes: dbSizeResult.data as number,
    storageBytes,
    storageByBucket,
    totalUsers: authStats?.total_users ?? 0,
    activeUsers28d: authStats?.active_28d ?? 0,
    // Not derivable from any query this app can run (compute tier is a
    // Management-API-only project setting) — set from what was
    // directly observed in the Supabase dashboard's Project Overview
    // ("COMPUTE: NANO") at the time this feature was built. Update
    // this to false once the project is upgraded to Micro compute
    // (Settings → Infrastructure) — same price on a paid plan, more
    // headroom (10 GB recommended max DB size vs Nano's 0.5 GB, and a
    // dedicated rather than free-tier-shared allocation).
    isOnNanoComputeUnderPaidPlan: true,
  };
}

export { PLATFORM_LIMITS, COMPUTE_TIERS };
