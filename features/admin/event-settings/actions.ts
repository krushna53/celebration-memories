"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { updateEvent, type EventUpdateInput } from "@/services/events";
import { createSignedShareImageUpload } from "@/services/uploads";
import type { SectionConfigItem } from "@/lib/section-registry";

export type AdminActionResult = { success: true } | { success: false; error: string };

export async function updateEventAction(
  eventId: string,
  input: EventUpdateInput,
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, input);
    revalidatePath("/admin/event-settings");
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/invite/[token]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateSectionConfigAction(
  eventId: string,
  config: SectionConfigItem[],
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { sectionConfig: config });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    revalidatePath("/events/[slug]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function requestShareImageUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false as const, error: "Not authorized." };

  try {
    const upload = await createSignedShareImageUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeShareImageAction(eventId: string): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { shareImagePath: null });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Saves the just-uploaded path as the event's link-preview image. */
export async function confirmShareImageUploadAction(
  eventId: string,
  path: string,
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { shareImagePath: path });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    revalidatePath("/invite/[token]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
