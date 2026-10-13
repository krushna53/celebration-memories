"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { saveRsvpConfig } from "@/services/rsvp-config";
import type { SaveRsvpConfigResult } from "@/features/admin/rsvp-form/actions";

/** Draft-token-gated mirror of saveRsvpConfigAction for the wizard's RSVP Form step. */
export async function draftSaveRsvpConfigAction(token: string, eventId: string, config: unknown): Promise<SaveRsvpConfigResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    return { success: true, config: await saveRsvpConfig(event.id, config) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}
