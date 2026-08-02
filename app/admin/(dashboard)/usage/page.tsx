import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getAllEventsUsage } from "@/services/usage-analytics";
import { formatBytes } from "@/lib/format-bytes";
import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";
import { PieChart } from "@/features/admin/components/pie-chart";

export const dynamic = "force-dynamic";

const PROVIDER_COLORS = {
  aiImage: "#4f46e5",
  shotstack: "#e5503c",
} as const;

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Owner-only cross-client usage + estimated spend dashboard — AI Image
 * generations, Shotstack renders (Slideshow Video + Video Editor
 * combined, since both bill against the same Shotstack account), and
 * Supabase Storage, broken down per event so the owner can see at a
 * glance which client is consuming the most. Same owner-only reasoning
 * and page-guard pattern as /admin/storage (see that page's comment) —
 * deliberately excluded from CLIENT_ALLOWED_PATHS in lib/admin-roles.ts.
 *
 * The dollar figures here are estimates from published list pricing
 * (lib/usage-pricing.ts), not live Shotstack/OpenAI billing data — see
 * that file's header comment for the exact assumptions and sources.
 */
export default async function AdminUsagePage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const usage = await getAllEventsUsage();

  const totals = usage.reduce(
    (acc, u) => ({
      aiImageCount: acc.aiImageCount + u.aiImageCount,
      shotstackRenders: acc.shotstackRenders + u.slideshowCount + u.videoEditorCount,
      storageBytes: acc.storageBytes + u.storageBytes,
      estimatedTotalCostUsd: acc.estimatedTotalCostUsd + u.estimatedTotalCostUsd,
    }),
    { aiImageCount: 0, shotstackRenders: 0, storageBytes: 0, estimatedTotalCostUsd: 0 },
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Usage & Estimated Spend</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Cross-client AI Image, Shotstack (Slideshow Video + Video Editor), and Supabase Storage
        consumption — spot which client is using the most before it becomes a billing surprise.
      </p>
      <p className="mt-3 rounded-lg border border-gold-500/25 bg-gold-500/5 px-3 py-2 text-xs leading-relaxed text-navy-700/70">
        Dollar figures below are <strong className="text-navy-950">estimates</strong> computed from
        published Shotstack/OpenAI list pricing, not pulled from either provider&apos;s live
        billing — see the comment in <code>lib/usage-pricing.ts</code> for the exact assumptions
        and sources. Generation counts and storage bytes are real, measured data.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Est. Total Spend" value={formatUsd(totals.estimatedTotalCostUsd)} />
        <StatCard label="AI Images Generated" value={totals.aiImageCount} />
        <StatCard label="Shotstack Renders" value={totals.shotstackRenders} />
        <StatCard label="Total Storage" value={formatBytes(totals.storageBytes)} />
      </div>

      {usage.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No live events yet.
        </p>
      ) : (
        <>
          <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg text-navy-950">Estimated Spend By Client</h2>
            <p className="mt-1 text-xs text-navy-700/50">
              AI Image + Shotstack combined, largest first. Storage isn&apos;t included here —
              Supabase storage cost depends on your plan, not a simple per-GB rate, so it&apos;s
              shown separately below as bytes, not dollars.
            </p>
            <div className="mt-4">
              <BarChart
                data={usage.map((u) => ({
                  label: u.honoreeName,
                  value: Number(u.estimatedTotalCostUsd.toFixed(2)),
                  color: PROVIDER_COLORS.shotstack,
                }))}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {usage.map((u) => (
              <div key={u.eventId} className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
                <div>
                  <h3 className="font-display text-base text-navy-950">{u.honoreeName}</h3>
                  <p className="text-xs text-navy-700/50">{u.eventTitle}</p>
                </div>
                <div className="mt-4">
                  <PieChart
                    centerLabel={formatUsd(u.estimatedTotalCostUsd)}
                    data={[
                      { label: "AI Image", value: u.estimatedAiImageCostUsd, color: PROVIDER_COLORS.aiImage },
                      { label: "Shotstack", value: u.estimatedShotstackCostUsd, color: PROVIDER_COLORS.shotstack },
                    ]}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-navy-700/70">
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>AI Images</dt>
                    <dd className="font-medium text-navy-950">{u.aiImageCount}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>Slideshow renders</dt>
                    <dd className="font-medium text-navy-950">{u.slideshowCount}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>Video Editor renders</dt>
                    <dd className="font-medium text-navy-950">{u.videoEditorCount}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>Storage</dt>
                    <dd className="font-medium text-navy-950">{formatBytes(u.storageBytes)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
