import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatBytes } from "@/lib/format-bytes";

/**
 * Per-event storage limit (events.storage_quota_gb, 5 GB by default,
 * editable in Event Settings). Enforced when an upload link is created
 * (services/uploads.ts), so a full event can't take more files, and
 * surfaced as a warning across the admin dashboard
 * (features/admin/storage/storage-quota-banner.tsx).
 *
 * Counts every file stored under the event (guest memories, gallery,
 * timeline, AI images, slideshow files…) — including items in the
 * Recycle Bin until they're purged.
 */

const GB = 1024 * 1024 * 1024;
export const DEFAULT_EVENT_QUOTA_GB = 5;
/** From this share of the quota the dashboard shows an "almost full" warning. */
export const STORAGE_WARNING_RATIO = 0.9;

export type StorageLevel = "ok" | "warning" | "full";

export interface EventStorageStatus {
  usedBytes: number;
  quotaBytes: number;
  /** 0..1+ */
  ratio: number;
  level: StorageLevel;
}

export class StorageQuotaError extends Error {}

async function usedBytes(eventId: string): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("event_storage_bytes", { p_event_id: eventId });
  if (error) throw new Error(`Couldn't check storage: ${error.message}`);
  return Number(data) || 0;
}

async function quotaBytes(eventId: string): Promise<number> {
  const { data } = await supabaseAdmin()
    .from("events")
    .select("storage_quota_gb")
    .eq("id", eventId)
    .maybeSingle<{ storage_quota_gb: number | string | null }>();
  const gb = Number(data?.storage_quota_gb) || DEFAULT_EVENT_QUOTA_GB;
  return gb * GB;
}

export async function getEventStorageStatus(eventId: string): Promise<EventStorageStatus> {
  const [used, quota] = await Promise.all([usedBytes(eventId), quotaBytes(eventId)]);
  const ratio = quota > 0 ? used / quota : 0;
  return {
    usedBytes: used,
    quotaBytes: quota,
    ratio,
    level: ratio >= 1 ? "full" : ratio >= STORAGE_WARNING_RATIO ? "warning" : "ok",
  };
}

/**
 * Throws StorageQuotaError when `incomingBytes` more wouldn't fit. `audience`
 * picks the wording: guests are asked to tell the host; hosts get next steps.
 * A failed usage lookup never blocks an upload — the limit is a safeguard,
 * not something that should take uploads down with it.
 */
export async function assertEventStorageAvailable(
  eventId: string,
  incomingBytes: number,
  audience: "guest" | "host" = "host",
): Promise<void> {
  let status: EventStorageStatus;
  try {
    status = await getEventStorageStatus(eventId);
  } catch (err) {
    console.error("assertEventStorageAvailable: usage check failed, allowing upload:", err);
    return;
  }
  if (status.usedBytes + Math.max(0, incomingBytes) <= status.quotaBytes) return;

  if (audience === "guest") {
    throw new StorageQuotaError(
      "This event's photo and video space is full, so new uploads can't be added right now. Please let the host know.",
    );
  }
  const left = Math.max(0, status.quotaBytes - status.usedBytes);
  throw new StorageQuotaError(
    status.usedBytes >= status.quotaBytes
      ? `This event has used all ${formatBytes(status.quotaBytes)} of its storage. Delete files you don't need (and use "Delete Forever" in the Recycle Bin), or contact us to increase the limit.`
      : `This file (${formatBytes(incomingBytes)}) is bigger than the space left for this event (${formatBytes(left)}). Delete files you don't need (and use "Delete Forever" in the Recycle Bin), or contact us to increase the limit.`,
  );
}
