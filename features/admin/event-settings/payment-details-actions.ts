"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { createPaymentImageUpload, savePaymentDetailsText, setPaymentImage } from "@/services/payment-details";

function revalidate() {
  revalidatePath("/admin/event-settings");
  revalidatePath("/events/[slug]", "page");
}

/** Saves (or clears, when empty) the event's payment details text. */
export async function savePaymentDetailsTextAction(eventId: string, text: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
    await savePaymentDetailsText(eventId, text);
    revalidate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

export async function requestPaymentImageUploadAction(
  eventId: string,
  contentType: string,
  fileSize: number,
): Promise<{ success: true; path: string; signedUrl: string } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
    return { success: true, ...(await createPaymentImageUpload(eventId, contentType, fileSize)) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/** Sets the uploaded image (or removes it with null). */
export async function setPaymentImageAction(eventId: string, path: string | null): Promise<{ success: true; url: string | null } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
    const url = await setPaymentImage(eventId, path);
    revalidate();
    return { success: true, url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save the image." };
  }
}
