"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { disableRsvpSheetToken, regenerateRsvpSheetToken, rsvpSheetUrl } from "@/services/rsvp-sheet";

export type RsvpSheetLinkResult = { success: true; url: string | null } | { success: false; error: string };

/** Creates the live sheet link, or replaces it — every sheet using the old link stops updating. */
export async function regenerateRsvpSheetLinkAction(eventId: string): Promise<RsvpSheetLinkResult> {
  try {
    await requireAdminForEvent(eventId);
    const token = await regenerateRsvpSheetToken(eventId);
    revalidatePath("/admin/rsvps");
    return { success: true, url: rsvpSheetUrl(token) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not create the link." };
  }
}

export async function disableRsvpSheetLinkAction(eventId: string): Promise<RsvpSheetLinkResult> {
  try {
    await requireAdminForEvent(eventId);
    await disableRsvpSheetToken(eventId);
    revalidatePath("/admin/rsvps");
    return { success: true, url: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not turn off the link." };
  }
}
