"use server";

import { redirect } from "next/navigation";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { updateEvent, type EventUpdateInput } from "@/services/events";
import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import type { AdminActionResult } from "@/features/admin/event-settings/actions";

/**
 * Draft-token-gated mirror of updateEventAction — used by the wizard's
 * "Event Basics" step (features/start/event-basics-form.tsx), which is
 * a smaller, wizard-specific form rather than a refactor of the full
 * admin EventSettingsForm (that form's AI CSS / WhatsApp template /
 * public RSVP link / homepage-section-ordering sections don't apply to
 * a not-yet-live draft — those stay in the real dashboard, configured
 * after the account exists).
 */
export async function draftUpdateEventAction(
  token: string,
  eventId: string,
  input: EventUpdateInput,
): Promise<AdminActionResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    await updateEvent(eventId, input);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Draft-token-gated mirror of confirmShareImageUploadAction — used by the AI Image step's "Use as invitation card" save and Event Basics' cover photo. */
export async function draftConfirmShareImageUploadAction(
  token: string,
  eventId: string,
  path: string,
): Promise<AdminActionResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    await updateEvent(eventId, { shareImagePath: path });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Draft-token-gated mirror of confirmShareVideoUploadAction — used by the Slideshow step's "Use as Link Preview Video" save. */
export async function draftConfirmShareVideoUploadAction(
  token: string,
  eventId: string,
  path: string,
): Promise<AdminActionResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    await updateEvent(eventId, { shareVideoPath: path });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Upsell path from the light/free Review screen (card/slideshow-only
 * goals) — adds "website" to the draft's goals so the rest of the
 * wizard's steps unlock, then sends the host to whichever step they
 * haven't already visited (Timeline, since Gallery/Timeline are the
 * pieces a card-or-slideshow-only host is most likely to have skipped).
 * See app/start/[token]/review/page.tsx.
 */
export async function draftAddWebsiteGoalAction(token: string, eventId: string): Promise<void> {
  const event = await requireDraftEvent(token);
  if (event.id !== eventId) redirect(wizardStepHref(token, "review"));

  const goals = new Set(event.wizardGoals ?? []);
  goals.add("website");
  await updateEvent(eventId, { wizardGoals: Array.from(goals) });

  const steps = resolveWizardSteps(Array.from(goals));
  const timelineStep = steps.find((s) => s.slug === "timeline");
  redirect(wizardStepHref(token, timelineStep?.slug ?? "review"));
}
