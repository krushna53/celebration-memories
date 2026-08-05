"use server";

import { redirect } from "next/navigation";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { updateEvent, type EventUpdateInput } from "@/services/events";
import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import { getCurrentAdmin } from "@/services/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

/** Draft-token-gated mirror of removeShareImageAction — clears the "Use as Link Preview Image" selection. */
export async function draftRemoveShareImageAction(token: string, eventId: string): Promise<AdminActionResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    await updateEvent(eventId, { shareImagePath: null });
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

/**
 * Lets an admin who's already signed in (a client-role admin whose
 * `admins.event_id` is null — e.g. an old registration that never got
 * linked, or a Google signup where the OAuth callback's link_event_id
 * step didn't run) claim a wizard draft as their event, instead of
 * going through AccountForm's signUp() flow. That flow has no
 * awareness of an existing session — using the same email fails as
 * "already registered" with no recovery path, and a different email
 * creates a genuinely separate identity, leaving the original admin
 * row orphaned. This does the equivalent of the OAuth callback's own
 * link_event_id linking (app/auth/callback/route.ts), just triggered
 * from inside the wizard instead of right after an OAuth redirect.
 *
 * Re-resolves both the draft event (from `token`) and the admin (from
 * the actual server session) rather than trusting anything the client
 * passed in. Guarded with `.is("event_id", null)` so this can only
 * ever set the link once — an admin already scoped to a different
 * event is turned back with an explanation rather than silently
 * reassigned.
 */
export async function linkDraftEventToExistingAdminAction(token: string): Promise<AdminActionResult> {
  const event = await requireDraftEvent(token);

  const admin = await getCurrentAdmin();
  if (!admin) {
    return { success: false, error: "You've been signed out — please sign in again." };
  }
  if (admin.eventId) {
    return {
      success: false,
      error: "This account is already linked to a different event. Sign out first if you meant to start a new one.",
    };
  }

  const { data, error } = await supabaseAdmin()
    .from("admins")
    .update({ event_id: event.id })
    .eq("id", admin.id)
    .is("event_id", null)
    .select("id");

  if (error) {
    return { success: false, error: "Something went wrong linking this event to your account." };
  }
  if (!data || data.length === 0) {
    return {
      success: false,
      error: "This account is already linked to a different event. Sign out first if you meant to start a new one.",
    };
  }

  redirect(wizardStepHref(token, "payment"));
}

/**
 * Thin `<form action={...}>`-compatible wrapper around
 * linkDraftEventToExistingAdminAction — a plain HTML form action must
 * return void/Promise<void>, but the action above returns an
 * AdminActionResult on failure (it only ever "returns" on failure,
 * since success redirects internally and never comes back). Failure
 * here is a rare edge case (session expired mid-submit, or a double
 * click racing the `.is("event_id", null)` guard) — bounces back to
 * the same step with the error message in the query string rather
 * than needing a full client-side form + useFormState just for this.
 */
export async function linkDraftEventFormAction(token: string): Promise<void> {
  const result = await linkDraftEventToExistingAdminAction(token);
  if (!result.success) {
    redirect(`${wizardStepHref(token, "account")}?linkError=${encodeURIComponent(result.error)}`);
  }
}
