import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import {
  STORAGE_CATEGORIES,
  getStorageOverview,
  type StorageCategory,
  type StorageUsageBreakdown,
} from "@/services/storage-usage";
import { formatBytes, bytesToGb } from "@/lib/format-bytes";
import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";
import { PieChart } from "@/features/admin/components/pie-chart";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<StorageCategory, string> = {
  memory_wall: "#ff6b57",
  gallery_timeline: "#4f46e5",
  slideshow: "#0ea5e9",
  ai_images: "#c9a227",
  video_editor: "#0f766e",
  share_display: "#7c3aed",
  other: "#94a3b8",
};

function pieData(usage: StorageUsageBreakdown) {
  return STORAGE_CATEGORIES.filter(
    (c) => usage.categories[c.key].bytes > 0,
  ).map((c) => ({
    label: `${c.label} · ${formatBytes(usage.categories[c.key].bytes)}`,
    value: usage.categories[c.key].bytes,
    color: CATEGORY_COLORS[c.key],
  }));
}

/**
 * Owner-only cross-client storage dashboard — every byte in Supabase
 * Storage, per live event and per category (Memory Wall, Gallery &
 * Timeline, Slideshow & Music, AI Images, Video Editor, Share & Display),
 * plus draft/inactive events and platform-level files that belong to no
 * event. Owner-only for the same reason /admin/events and /admin/referrals
 * are: comparing usage across every client isn't something a client-role
 * admin should see about other clients' events. See
 * services/storage-usage.ts for how the bytes are computed.
 */
export default async function AdminStoragePage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const { events, otherEvents, platform, totals, grandTotalBytes } =
    await getStorageOverview();
  const platformBytes = platform.reduce((a, r) => a + r.bytes, 0);
  const withFiles = events.filter((u) => u.totalBytes > 0);
  const emptyCount = events.length - withFiles.length;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Storage Usage</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Everything in Supabase Storage — per event, by what it&rsquo;s used for,
        plus draft events and platform files.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Storage" value={formatBytes(grandTotalBytes)} />
        {STORAGE_CATEGORIES.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={formatBytes(totals.categories[c.key].bytes)}
          />
        ))}
        <StatCard label="Platform Files" value={formatBytes(platformBytes)} />
      </div>

      <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg text-navy-950">
          What Takes The Space
        </h2>
        <p className="mt-1 text-xs text-navy-700/50">
          All events combined (live, draft and inactive).
        </p>
        <div className="mt-4">
          <PieChart
            centerLabel={formatBytes(totals.totalBytes)}
            data={pieData(totals)}
          />
        </div>
        <ul className="mt-5 grid gap-x-6 gap-y-2 text-xs text-navy-700/70 sm:grid-cols-2">
          {STORAGE_CATEGORIES.map((c) => (
            <li key={c.key}>
              <span className="font-medium text-navy-950">{c.label}</span> —{" "}
              {c.hint} ·{" "}
              {totals.categories[c.key].files.toLocaleString("en-IN")} files
            </li>
          ))}
        </ul>
      </div>

      {events.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No live events yet.
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg text-navy-950">
              Usage By Client
            </h2>
            <p className="mt-1 text-xs text-navy-700/50">
              Total storage per live event, largest first (GB).
            </p>
            <div className="mt-4">
              <BarChart
                data={withFiles.map((u) => ({
                  label: u.honoreeName,
                  value: bytesToGb(u.totalBytes),
                  color: CATEGORY_COLORS.memory_wall,
                }))}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {withFiles.map((u) => (
              <div
                key={u.eventId}
                className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm"
              >
                <h3 className="font-display text-base text-navy-950">
                  {u.honoreeName}
                </h3>
                <p className="text-xs text-navy-700/50">
                  {u.eventTitle} · {u.totalFiles.toLocaleString("en-IN")} files
                </p>
                <div className="mt-4">
                  <PieChart
                    centerLabel={formatBytes(u.totalBytes)}
                    data={pieData(u)}
                  />
                </div>
              </div>
            ))}
          </div>
          {emptyCount > 0 ? (
            <p className="mt-3 text-xs text-navy-700/50">
              + {emptyCount} live {emptyCount === 1 ? "event" : "events"} with
              no files yet.
            </p>
          ) : null}
        </>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
          <h3 className="font-display text-base text-navy-950">
            Drafts & Inactive Events
          </h3>
          <p className="text-xs text-navy-700/50">
            {otherEvents.eventCount} events not live yet (wizard drafts, demos,
            archived) · {otherEvents.totalFiles.toLocaleString("en-IN")} files
          </p>
          <div className="mt-4">
            <PieChart
              centerLabel={formatBytes(otherEvents.totalBytes)}
              data={pieData(otherEvents)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
          <h3 className="font-display text-base text-navy-950">
            Platform Files
          </h3>
          <p className="text-xs text-navy-700/50">
            Not tied to any event · {formatBytes(platformBytes)}
          </p>
          {platform.length === 0 ? (
            <p className="mt-4 text-xs text-navy-700/40">None.</p>
          ) : (
            <ul className="mt-4 divide-y divide-navy-950/5 text-sm">
              {platform.map((row) => (
                <li
                  key={row.location}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-navy-950">
                      {row.label}
                    </span>
                    {row.label !== row.location ? (
                      <span className="block truncate text-[11px] text-navy-700/40">
                        {row.location}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-navy-700/60">
                    {formatBytes(row.bytes)} · {row.files} files
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
