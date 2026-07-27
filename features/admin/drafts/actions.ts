"use server";

import { requireOwner } from "@/services/admin-auth";
import { deleteDraftEvent } from "@/services/event-drafts";

export type AdminActionResult = { success: true } | { success: false; error: string };

/** Owner-only — permanently deletes a draft event and everything cascading from it. See services/event-drafts.ts. */
export async function deleteDraftEventAction(id: string): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await deleteDraftEvent(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete." };
  }
}
