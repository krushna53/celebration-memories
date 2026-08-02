import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getAllEventsStorageUsage } from "@/services/storage-usage";
import { formatBytes, bytesToGb } from "@/lib/format-bytes";
import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";
import { PieChart } from "@/features/admin/components/pie-chart";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS = {
  galleryTimeline: "#21395e",
  slideshow: "#a9861e",
  memoryWall: "#c9a227",
} as const;

/**
 * Owner-only cross-client storage dashboard — how much Supabase Storage
 * each live event is using, broken down by Gallery & Timeline, Slideshow
 * Video, and Memory Wall (guest uploads). Owner-only for the same reason
 * /admin/events and /admin/referrals are: comparing usage across every
 * client isn't something a client-role admin should see about other
 * clients' events. See services/storage-usage.ts for how the bytes are
 * computed and its note on caching this if it gets slow.
 */
export default async function AdminStoragePage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const usage = await getAllEventsStorageUsage();

  const totals = usage.reduce(
    (acc, u) => ({
      galleryTimelineBytes: acc.galleryTimelineBytes + u.galleryTimelineBytes,
      slideshowBytes: acc.slideshowBytes + u.slideshowBytes,
      memoryWallBytes: acc.memoryWallBytes + u.memoryWallBytes,
      totalBytes: acc.totalBytes + u.totalBytes,
    }),
    { galleryTimelineBytes: 0, slideshowBytes: 0, memoryWallBytes: 0, totalBytes: 0 },
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Storage Usage</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        How much Supabase Storage each live event is using — Gallery & Timeline photos, rendered
        Slideshow videos, and guest Memory Wall uploads.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Across All Events" value={formatBytes(totals.totalBytes)} />
        <StatCard label="Gallery & Timeline" value={formatBytes(totals.galleryTimelineBytes)} />
        <StatCard label="Slideshow Video" value={formatBytes(totals.slideshowBytes)} />
        <StatCard label="Memory Wall" value={formatBytes(totals.memoryWallBytes)} />
      </div>

      {usage.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No live events yet.
        </p>
      ) : (
        <>
          <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg text-navy-950">Usage By Client</h2>
            <p className="mt-1 text-xs text-navy-700/50">Total storage per event, largest first.</p>
            <div className="mt-4">
              <BarChart
                data={usage.map((u) => ({
                  label: u.honoreeName,
                  value: bytesToGb(u.totalBytes),
                  color: CATEGORY_COLORS.memoryWall,
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
                    centerLabel={formatBytes(u.totalBytes)}
                    data={[
                      { label: "Gallery & Timeline", value: u.galleryTimelineBytes, color: CATEGORY_COLORS.galleryTimeline },
                      { label: "Slideshow Video", value: u.slideshowBytes, color: CATEGORY_COLORS.slideshow },
                      { label: "Memory Wall", value: u.memoryWallBytes, color: CATEGORY_COLORS.memoryWall },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
