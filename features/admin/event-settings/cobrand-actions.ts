"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { parseCobrandInput, saveEventCobrand } from "@/services/event-cobrand";

/** Saves the "Powered by <organiser>" line for one event. Empty name clears it. */
export async function updateEventCobrandAction(
  eventId: string,
  name: string,
  url: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  const parsed = parseCobrandInput(name, url);
  if (!parsed.ok) return { success: false, error: parsed.error };

  try {
    await saveEventCobrand(eventId, parsed.patch);
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/invite/[token]", "page");
    revalidatePath("/admin/event-settings");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}
