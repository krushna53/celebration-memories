import "server-only";
import { headers } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, hashIp } from "@/lib/ip-hash";

/**
 * Brute-force protection for short, guessable secrets — see migration
 * 0066_security_failed_attempts.sql for the model. Wrap a lookup in
 * guardedLookup(): if the caller's IP already has too many recent
 * failures for that scope the lookup isn't even attempted (so a correct
 * guess after the limit still fails), and a lookup that comes back empty
 * is recorded as a failure.
 *
 * Fails OPEN — if the IP can't be determined or the table can't be read,
 * the lookup runs normally. Locking real guests out of their invitation
 * because a bookkeeping query failed would be worse than briefly losing
 * brute-force protection.
 */
export type GuardScope = "invite-token" | "event-day-phone" | "promo-code" | "mobile-access-code";

const LIMITS: Record<GuardScope, { maxFailures: number; windowMinutes: number }> = {
  // A guest mistyping a link a few times never gets near this.
  "invite-token": { maxFailures: 20, windowMinutes: 15 },
  "event-day-phone": { maxFailures: 10, windowMinutes: 15 },
  "promo-code": { maxFailures: 8, windowMinutes: 60 },
  "mobile-access-code": { maxFailures: 5, windowMinutes: 15 },
};

export async function currentIpHash(): Promise<string | null> {
  try {
    const ip = getClientIp(await headers());
    return ip === "unknown" ? null : hashIp(ip);
  } catch {
    // Outside a request (build, cron, script) — nothing to rate-limit.
    return null;
  }
}

export async function isLockedOut(scope: GuardScope, ipHash?: string | null): Promise<boolean> {
  const hash = ipHash === undefined ? await currentIpHash() : ipHash;
  if (!hash) return false;

  const { maxFailures, windowMinutes } = LIMITS[scope];
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("security_failed_attempts")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .eq("ip_hash", hash)
    .gte("created_at", since);

  if (error) {
    console.error("abuse-guard: lockout check failed:", error.message);
    return false;
  }
  return (count ?? 0) >= maxFailures;
}

export async function recordFailure(scope: GuardScope, ipHash?: string | null): Promise<void> {
  const hash = ipHash === undefined ? await currentIpHash() : ipHash;
  if (!hash) return;

  const client = supabaseAdmin();
  const { error } = await client.from("security_failed_attempts").insert({ scope, ip_hash: hash });
  if (error) console.error("abuse-guard: failed to record attempt:", error.message);

  // Housekeeping without a cron job: roughly 1 in 50 failures clears rows
  // older than a day (every window above is at most an hour).
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    await client.from("security_failed_attempts").delete().lt("created_at", cutoff);
  }
}

/**
 * Runs `lookup` unless the caller is locked out for `scope`; a null /
 * false / undefined result counts as a failed guess. Returns null when
 * locked out, so callers treat it exactly like "not found" and never
 * reveal whether a value was right.
 */
export async function guardedLookup<T>(
  scope: GuardScope,
  lookup: () => Promise<T | null | undefined | false>,
): Promise<T | null> {
  const hash = await currentIpHash();
  if (await isLockedOut(scope, hash)) return null;

  const result = await lookup();
  if (result === null || result === undefined || result === false) {
    await recordFailure(scope, hash);
    return null;
  }
  return result;
}
