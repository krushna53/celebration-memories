"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin, requireAdminForEvent } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import {
  createSignedAdminMediaUpload,
  confirmAdminMediaUpload,
  submitAdminGuestbookNote,
} from "@/services/uploads";

type Result<T = void> = { success: true; data: T } | { success: false; error: string };

/**
 * Step 1: mint a signed Storage URL so the browser can PUT the file
 * directly to Supabase Storage without routing through the server.
 * Auth: owner or the client admin assigned to this event.
 */
export async function adminRequestMediaUploadAction(
  kind: "photo" | "video" | "audio",
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<Result<{ bucket: string; path: string; token: string; signedUrl: string }>> {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return { success: false, error: "Not authenticated." };
    const event = await resolveAdminEvent(admin);
    if (!event) return { success: false, error: "No event found for this account." };
    await requireAdminForEvent(event.id);

    const result = await createSignedAdminMediaUpload({
      adminId: admin.id,
      eventId: event.id,
      kind,
      fileName,
      contentType,
      fileSize,
    });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/**
 * Step 2: record the completed upload in the DB with approved = true.
 * Called after the browser has finished the direct-to-Storage PUT.
 */
export async function adminConfirmMediaUploadAction(
  kind: "photo" | "video" | "audio",
  path: string,
  caption?: string,
): Promise<Result<{ id: string }>> {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return { success: false, error: "Not authenticated." };
    const event = await resolveAdminEvent(admin);
    if (!event) return { success: false, error: "No event found." };
    await requireAdminForEvent(event.id);

    const result = await confirmAdminMediaUpload({
      adminId: admin.id,
      eventId: event.id,
      kind,
      path,
      caption,
    });

    revalidatePath("/admin/memories");
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

/**
 * Add a guestbook/note entry directly as the admin — appears on the
 * Memory Wall immediately (approved = true, no moderation step).
 */
export async function adminAddGuestbookNoteAction(
  guestName: string,
  message: string,
  country?: string,
): Promise<Result> {
  try {
    if (!guestName.trim() || !message.trim()) {
      return { success: false, error: "Name and message are required." };
    }
    const admin = await getCurrentAdmin();
    if (!admin) return { success: false, error: "Not authenticated." };
    const event = await resolveAdminEvent(admin);
    if (!event) return { success: false, error: "No event found." };
    await requireAdminForEvent(event.id);

    await submitAdminGuestbookNote({
      adminId: admin.id,
      eventId: event.id,
      guestName: guestName.trim(),
      message: message.trim(),
      country: country?.trim(),
    });

    revalidatePath("/admin/memories");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}
