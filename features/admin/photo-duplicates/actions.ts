"use server";

import { requireAdminForOrganizerArea } from "@/services/admin-auth";
import { hashPendingPhotos, listSimilarPhotoGroups } from "@/services/photo-hashes";

/** One small batch of look-alike hashing — the panel calls it until nothing is left. */
export async function hashPendingPhotosAction(eventId: string) {
  try {
    await requireAdminForOrganizerArea(eventId, "timeline");
    return { success: true as const, data: await hashPendingPhotos(eventId) };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function listSimilarPhotosAction(eventId: string) {
  try {
    await requireAdminForOrganizerArea(eventId, "timeline");
    return { success: true as const, data: await listSimilarPhotoGroups(eventId) };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
