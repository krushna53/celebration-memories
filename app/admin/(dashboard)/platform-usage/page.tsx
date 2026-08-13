import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getPlatformCapacitySnapshot } from "@/services/platform-capacity";
import { getAllEventsUsage } from "@/services/usage-analytics";
import { getFormAiUsageByOwner } from "@/services/form-ai-usage";
import { PLATFORM_LIMITS, COMPUTE_TIERS, percentOfLimit } from "@/lib/platform-limits";
import { formatBytes } from "@/lib/format-bytes";
import { StatCard } from "@/features/admin/components/stat-card";

export const dynamic = "force-dynamic";

function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

function formatPercent(pct: number): string {
  if (pct < 0.01) return "<0.01%";
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}

function barColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-gold-500";
}

function UsageBar({ label, usedBytes, limitBytes }: { label: string; usedBytes: number; limitBytes: number }) {
  const pct = percentOfLimit(usedBytes, limitBytes);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-navy-700/70">
        <span>{label}</span>
        <span className="font-medium text-navy-950">
          {formatBytes(usedBytes)} / {formatBytes(limitBytes)} ({formatPercent(pct)})
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-950/10">
        <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}

/**
 * Owner-only "how much room is left, and who's using it" dashboard —
 * combines two things that were previously separate concerns:
 *
 * 1. Supabase plan capacity vs actual usage (this project's own Pro
 *    subscription — DB size, Storage, Monthly Active Users — see
 *    services/platform-capacity.ts and lib/platform-limits.ts for
 *    where the real numbers and the plan's included quotas come from).
 * 2. Per-account usage + estimated cost, split by product since this
 *    app has three separate identity tables with genuinely different
 *    metered tools: events/admins (AI Image, Shotstack, Storage — see
 *    services/usage-analytics.ts, already powers /admin/usage) and
 *    Build RSVP / Form owners (AI form generation — see
 *    services/form-ai-usage.ts's getFormAiUsageByOwner). Marketplace
 *    vendor accounts have no metered paid-tool usage anywhere in this
 *    app today, so there's nothing to attribute per vendor yet.
 *
 * Same "estimates from published pricing, not live billing" caveat as
 * /admin/usage throughout — see lib/usage-pricing.ts and
 * lib/platform-limits.ts's header comments for sources.
 */
export default async function PlatformUsagePage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const [capacity, eventUsage, formOwnerUsage] = await Promise.all([
    getPlatformCapacitySnapshot(),
    getAllEventsUsage(),
    getFormAiUsageByOwner(),
  ]);

  const dbPct = percentOfLimit(capacity.dbSizeBytes, PLATFORM_LIMITS.dbSizeBytes);
  const storagePct = percentOfLimit(capacity.storageBytes, PLATFORM_LIMITS.storageBytes);

  // Rough capacity outlook: at current average bytes/event, how many
  // total events could this project's events/admins hold before
  // Storage — the fastest-growing of the three quotas by far in this
  // app's usage pattern (guest video/photo/audio uploads) — hits its
  // included allowance. A crude linear projection, not a forecast (per-
  // event usage varies a lot by how many guests actually upload), but
  // useful as an order-of-magnitude sanity check.
  const avgBytesPerEvent = eventUsage.length > 0 ? capacity.storageBytes / eventUsage.length : 0;
  const projectedEventsAtStorageLimit =
    avgBytesPerEvent > 0 ? Math.floor(PLATFORM_LIMITS.storageBytes / avgBytesPerEvent) : null;

  const totalEstimatedEventCost = eventUsage.reduce(
    (sum, u) => sum + u.estimatedTotalCostUsd + u.estimatedStorageCostUsd,
    0,
  );
  const totalEstimatedFormCost = formOwnerUsage.owners.reduce((sum, o) => sum + o.costUsd, 0) + formOwnerUsage.unattributedCostUsd;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Platform Utilization</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        How much of your Supabase {capacity.planName} plan is actually in use, and which accounts
        are driving it — a companion to <code>/admin/usage</code>&rsquo;s per-tool spend breakdown.
      </p>

      {capacity.isOnNanoComputeUnderPaidPlan ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-navy-700/80">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <p>
            <strong className="text-navy-950">This project is still running Nano compute on a paid plan.</strong>{" "}
            Supabase bills Nano at the same price as Micro for paid organizations but doesn&rsquo;t
            auto-upgrade it (a compute change causes a couple minutes of downtime). Upgrading to
            Micro (Supabase Dashboard → Settings → Infrastructure) costs nothing extra and raises
            the recommended max database size from {COMPUTE_TIERS.nano.recommendedMaxDbGb} GB to{" "}
            {COMPUTE_TIERS.micro.recommendedMaxDbGb} GB — worth doing since you&rsquo;re already
            paying for it.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm sm:grid-cols-3">
        <UsageBar label="Database size" usedBytes={capacity.dbSizeBytes} limitBytes={PLATFORM_LIMITS.dbSizeBytes} />
        <UsageBar label="Storage" usedBytes={capacity.storageBytes} limitBytes={PLATFORM_LIMITS.storageBytes} />
        <UsageBar
          label="Monthly Active Users (28-day proxy)"
          usedBytes={capacity.activeUsers28d}
          limitBytes={PLATFORM_LIMITS.mau}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Accounts" value={capacity.totalUsers} hint="admins + business + form owners" />
        <StatCard label="Active (28d)" value={capacity.activeUsers28d} />
        <StatCard label="Live Events" value={eventUsage.length} />
        <StatCard label="Est. Monthly Tool Spend" value={formatUsd(totalEstimatedEventCost + totalEstimatedFormCost)} />
      </div>

      <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg text-navy-950">Storage by bucket</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {capacity.storageByBucket.map((b) => (
            <div key={b.bucketId} className="flex items-center justify-between rounded-lg bg-ivory-100 px-3 py-2 text-sm">
              <span className="capitalize text-navy-700/70">{b.bucketId}</span>
              <span className="font-medium text-navy-950">
                {formatBytes(b.totalBytes)} <span className="text-navy-700/50">({b.objectCount})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gold-500/25 bg-gold-500/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-navy-950">
          <CheckCircle2 size={18} className="text-gold-600" /> Capacity outlook
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-700/80">
          At {formatBytes(capacity.dbSizeBytes)} database size and {formatBytes(capacity.storageBytes)} of
          Storage across {eventUsage.length} live event{eventUsage.length === 1 ? "" : "s"}, this project is
          using {formatPercent(dbPct)} of its included database size and {formatPercent(storagePct)} of its
          included Storage — both have enormous headroom on the {capacity.planName} plan.{" "}
          {projectedEventsAtStorageLimit !== null ? (
            <>
              At the current average of {formatBytes(avgBytesPerEvent)} of Storage per event, roughly{" "}
              <strong className="text-navy-950">{projectedEventsAtStorageLimit.toLocaleString()} live events</strong> could
              run before Storage alone reaches its included {formatBytes(PLATFORM_LIMITS.storageBytes)} — and even past
              that point, overage is inexpensive (${PLATFORM_LIMITS.storageOverageUsdPerGb}/GB).
            </>
          ) : null}{" "}
          Monthly Active Users has the most headroom of all three — only guest-facing pages need no
          account at all (invite-token/draft-token access), so MAU only grows with host/vendor/form-owner
          signups, not guest traffic.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-navy-700/80">
          The real limiting factor isn&rsquo;t any of these three quotas — it&rsquo;s{" "}
          <strong className="text-navy-950">compute</strong> (shared CPU, {COMPUTE_TIERS.micro.maxConnections} max direct
          DB connections, {COMPUTE_TIERS.micro.maxPoolerClients} pooler clients on Micro), which governs how much{" "}
          <em>simultaneous</em> traffic the project can serve — many admins actively editing at once, or a
          surge of guests RSVPing/uploading during an event&rsquo;s live window — not the total number of
          events or accounts ever created. Watch CPU/connection metrics in the Supabase dashboard as event-day
          traffic grows, and upgrade compute (Small, then Medium) if those start running hot — storage and
          database size are unlikely to ever be the bottleneck at this platform&rsquo;s usage pattern.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg text-navy-950">Per-event / host account cost</h2>
        <p className="mt-1 text-xs text-navy-700/50">
          AI Image + Shotstack (real spend estimate, same figures as <code>/admin/usage</code>) plus what this
          event&rsquo;s Storage bytes would cost <em>if</em> billed at Supabase&rsquo;s per-GB overage rate — a
          proxy for which client is the heaviest storage consumer, not a real charge, since total platform
          Storage is well under the included allowance.
        </p>
        {eventUsage.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
            No live events yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-navy-700/50">
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Storage</th>
                  <th className="py-2 pr-4">AI Image + Shotstack</th>
                  <th className="py-2 pr-4">Storage (if billed)</th>
                  <th className="py-2 pr-4">Est. total</th>
                </tr>
              </thead>
              <tbody>
                {eventUsage.map((u) => (
                  <tr key={u.eventId} className="border-b border-navy-950/5 last:border-0">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-navy-950">{u.honoreeName}</p>
                      <p className="text-xs text-navy-700/50">{u.eventTitle}</p>
                    </td>
                    <td className="py-2 pr-4 text-navy-700/80">{formatBytes(u.storageBytes)}</td>
                    <td className="py-2 pr-4 text-navy-700/80">{formatUsd(u.estimatedTotalCostUsd)}</td>
                    <td className="py-2 pr-4 text-navy-700/80">{formatUsd(u.estimatedStorageCostUsd)}</td>
                    <td className="py-2 pr-4 font-medium text-navy-950">
                      {formatUsd(u.estimatedTotalCostUsd + u.estimatedStorageCostUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg text-navy-950">Per Build RSVP / Form owner cost</h2>
        <p className="mt-1 text-xs text-navy-700/50">
          AI form generation only — the only metered tool this product has. Real OpenAI token counts
          converted to an estimated dollar figure (<code>lib/usage-pricing.ts</code>).
        </p>
        {formOwnerUsage.owners.length === 0 && formOwnerUsage.unattributedCount === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
            No AI form generations yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-navy-700/50">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Generations</th>
                  <th className="py-2 pr-4">Tokens</th>
                  <th className="py-2 pr-4">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {formOwnerUsage.owners.map((o) => (
                  <tr key={o.ownerId} className="border-b border-navy-950/5 last:border-0">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-navy-950">{o.name ?? o.email}</p>
                      {o.name ? <p className="text-xs text-navy-700/50">{o.email}</p> : null}
                    </td>
                    <td className="py-2 pr-4 text-navy-700/80">{o.generationCount}</td>
                    <td className="py-2 pr-4 text-navy-700/80">{o.totalTokens.toLocaleString()}</td>
                    <td className="py-2 pr-4 font-medium text-navy-950">{formatUsd(o.costUsd)}</td>
                  </tr>
                ))}
                {formOwnerUsage.unattributedCount > 0 ? (
                  <tr className="border-b border-navy-950/5 last:border-0">
                    <td className="py-2 pr-4 text-navy-700/60">
                      Unattributed <span className="text-xs">(before an account was created)</span>
                    </td>
                    <td className="py-2 pr-4 text-navy-700/80">{formOwnerUsage.unattributedCount}</td>
                    <td className="py-2 pr-4 text-navy-700/50">—</td>
                    <td className="py-2 pr-4 font-medium text-navy-950">{formatUsd(formOwnerUsage.unattributedCostUsd)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-navy-700/50">
        Marketplace vendor accounts (Discover listings) have no metered paid-tool usage anywhere in
        this app today, so there&rsquo;s nothing to attribute per vendor yet.
      </p>
    </div>
  );
}
