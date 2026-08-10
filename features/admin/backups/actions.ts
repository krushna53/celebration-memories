"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  getSnapshotById,
  restoreEventSettingsSnapshot,
  restoreGallerySnapshot,
  restoreInviteesSnapshot,
  restoreTimelineSnapshot,
  type RestoreInviteesResult,
} from "@/services/event-snapshots";

export type RestoreSnapshotResult =
  | { success: true; area: "event_settings" | "gallery" | "timeline" }
  | { success: true; area: "invitees"; detail: RestoreInviteesResult }
  | { success: false; error: string };

function revalidateAllContentPaths() {
  revalidatePath("/admin/backups");
  revalidatePath("/admin/event-settings");
  revalidatePath("/admin/gallery");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/invitees");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/invite/[token]", "page");
  revalidatePath("/events/[slug]", "page");
}

/**
 * Restores one snapshot — re-resolves the snapshot's own eventId
 * server-side and checks the caller against it (never trusts a
 * client-supplied eventId), same "possession of a token/id is the
 * credential, but always re-verify" pattern as everywhere else in this
 * app. Dispatches to the right area-specific restore function
 * (services/event-snapshots.ts) based on the snapshot's own `area`
 * column, not a client-supplied area string.
 */
export async function restoreSnapshotAction(snapshotId: string): Promise<RestoreSnapshotResult> {
  const snap = await getSnapshotById(snapshotId);
  if (!snap) return { success: false, error: "That backup no longer exists." };

  let admin;
  try {
    admin = await requireAdminForEvent(snap.eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    if (snap.area === "event_settings") {
      await restoreEventSettingsSnapshot(snapshotId, admin.id);
      revalidateAllContentPaths();
      return { success: true, area: "event_settings" };
    }
    if (snap.area === "gallery") {
      await restoreGallerySnapshot(snapshotId, admin.id);
      revalidateAllContentPaths();
      return { success: true, area: "gallery" };
    }
    if (snap.area === "timeline") {
      await restoreTimelineSnapshot(snapshotId, admin.id);
      revalidateAllContentPaths();
      return { success: true, area: "timeline" };
    }
    const detail = await restoreInviteesSnapshot(snapshotId, admin.id);
    revalidateAllContentPaths();
    return { success: true, area: "invitees", detail };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Restore failed." };
  }
}
