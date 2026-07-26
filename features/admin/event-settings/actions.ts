"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { updateEvent, type EventUpdateInput } from "@/services/events";

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
