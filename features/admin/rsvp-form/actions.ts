"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { saveRsvpConfig } from "@/services/rsvp-config";
import type { RsvpConfig } from "@/lib/rsvp-config";

export type SaveRsvpConfigResult = { success: true; config: RsvpConfig } | { success: false; error: string };

/** Saves an event's RSVP form setup (sanitised server-side — lib/rsvp-config.ts). */
export async function saveRsvpConfigAction(eventId: string, config: unknown): Promise<SaveRsvpConfigResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }
  try {
    const saved = await saveRsvpConfig(eventId, config);
    revalidatePath("/admin/rsvp-form");
    revalidatePath("/invite/[token]", "page");
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/events/[slug]/rsvp", "page");
    return { success: true, config: saved };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}
