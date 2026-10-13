"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { saveRsvpConfig } from "@/services/rsvp-config";
import { generateRsvpConfigForEvent } from "@/services/rsvp-ai";
import type { GenerateRsvpConfigResult, SaveRsvpConfigResult } from "@/features/admin/rsvp-form/actions";

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

/** Draft-token-gated "Generate with AI" for the wizard's RSVP Form step (same per-event daily limit as hosts). */
export async function draftGenerateRsvpConfigAction(
  token: string,
  eventId: string,
  input: { prompt?: string; imageDataUrl?: string },
): Promise<GenerateRsvpConfigResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    return { success: true, config: await generateRsvpConfigForEvent(event, input, { adminId: null, exempt: false }) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "AI generation failed." };
  }
}
