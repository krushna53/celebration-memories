import Link from "next/link";
import { AlertTriangle, HardDrive } from "lucide-react";

import { formatBytes } from "@/lib/format-bytes";
import { resolveAdminEvent } from "@/lib/admin-event";
import { isPathAllowedForRole } from "@/lib/admin-roles";
import { getEventStorageStatus } from "@/services/storage-quota";
import type { CurrentAdmin } from "@/services/admin-auth";

/**
 * Strip across the top of the admin dashboard when the event being
 * managed is nearly out of storage (90%+) or full — full means new
 * uploads are blocked (services/storage-quota.ts), so hosts should hear
 * about it before a guest does. Renders nothing below 90%, or if usage
 * can't be read.
 */
export async function StorageQuotaBanner({ admin }: { admin: CurrentAdmin }) {
  const event = await resolveAdminEvent(admin).catch(() => null);
  if (!event) return null;

  const status = await getEventStorageStatus(event.id).catch(() => null);
  if (!status || status.level === "ok") return null;

  const full = status.level === "full";
  const percent = Math.min(100, Math.round(status.ratio * 100));
  const canOpenSettings = isPathAllowedForRole("/admin/event-settings", admin.role);
  const canOpenBin = isPathAllowedForRole("/admin/recycle-bin", admin.role);

  return (
    <div
      role={full ? "alert" : "status"}
      className={full ? "border-b border-red-200 bg-red-50" : "border-b border-amber-200 bg-amber-50"}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-6">
        <div className="flex min-w-0 items-start gap-2">
          {full ? (
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-600" />
          ) : (
            <HardDrive size={17} className="mt-0.5 shrink-0 text-amber-700" />
          )}
          <p className={full ? "text-red-800" : "text-amber-900"}>
            <strong className="font-semibold">
              {full ? "Storage full" : `Storage ${percent}% full`}
            </strong>{" "}
            — {formatBytes(status.usedBytes)} of {formatBytes(status.quotaBytes)} used.{" "}
            {full
              ? "Guests and the dashboard can't upload new photos or videos until space is freed or the limit is raised."
              : "Uploads will stop once it's full."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
          {canOpenBin ? (
            <Link href="/admin/recycle-bin" className={full ? "text-red-700 underline underline-offset-2" : "text-amber-800 underline underline-offset-2"}>
              Free up space
            </Link>
          ) : null}
          {canOpenSettings ? (
            <Link href="/admin/event-settings#storage" className={full ? "text-red-700 underline underline-offset-2" : "text-amber-800 underline underline-offset-2"}>
              {admin.role === "owner" ? "Raise the limit" : "Storage details"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
