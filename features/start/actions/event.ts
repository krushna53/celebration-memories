"use server";

import { redirect } from "next/navigation";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { updateEvent, type EventUpdateInput } from "@/services/events";
import { withoutPlanLimits } from "@/lib/plan-limits";
import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import { getCurrentAdmin } from "@/services/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveTimezoneFromAddress } from "@/lib/timezone-lookup";
import { setActiveEventOverrideId } from "@/lib/admin-active-event";
import type { AdminActionResult, DetectTimezoneResult } from "@/features/admin/event-settings/actions";

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
    // Plan limits (storage quota, AI caps) are set by the platform — never by whoever holds a draft link.
    await updateEvent(eventId, withoutPlanLimits(input));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Draft-token-gated mirror of detectEventTimezoneAction (features/admin/
 * event-settings/actions.ts) — the wizard's Event Details step has no
 * admin session to check yet, so this re-resolves the draft from
 * `token` instead of requireAdminForEvent. Same pure-lookup contract:
 * no side effect, the host still has to hit Save & Continue to apply
 * whatever it finds.
 */
export async function draftDetectEventTimezoneAction(
  token: string,
  eventId: string,
  address: string,
): Promise<DetectTimezoneResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  if (!address.trim()) {
    return { success: false, error: "Enter a venue address first." };
  }

  const timezone = await resolveTimezoneFromAddress(address);
  if (!timezone) {
    return { success: false, error: "Couldn't detect a timezone for that address — please choose one manually." };
  }
  return { success: true, timezone };
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
 * Adds a wizard draft to an existing account as one more event the
 * person hosts (admin_event_memberships), makes it their primary event if
 * they had none, and switches their dashboard to it.
 */
async function addDraftToAccount(adminId: string, eventId: string): Promise<AdminActionResult> {
  const client = supabaseAdmin();
  const { error } = await client
    .from("admin_event_memberships")
    .upsert({ admin_id: adminId, event_id: eventId, role: "client" }, { onConflict: "admin_id,event_id" });
  if (error) return { success: false, error: "Something went wrong linking this event to your account." };
  await client.from("admins").update({ event_id: eventId }).eq("id", adminId).is("event_id", null);
  await setActiveEventOverrideId(eventId).catch(() => {});
  return { success: true };
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
 * passed in. A host who already runs other events just gets this one
 * added (addDraftToAccount) — their existing events are untouched.
 */
export async function linkDraftEventToExistingAdminAction(token: string): Promise<AdminActionResult> {
  const event = await requireDraftEvent(token);

  const admin = await getCurrentAdmin();
  if (!admin) {
    return { success: false, error: "You've been signed out — please sign in again." };
  }
  if (admin.role === "owner") {
    return {
      success: false,
      error: "You're signed in as the site owner. Sign out first to set this event up under the host's own account.",
    };
  }

  // A host can run several events: this one is simply added to their account.
  const linked = await addDraftToAccount(admin.id, event.id);
  if (!linked.success) return linked;

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

/**
 * Sibling of linkDraftEventToExistingAdminAction for the case that
 * function can't handle: someone already signed in under this shared
 * Supabase Auth project, but with no `admins` row at all yet — a
 * Marketplace vendor or Build RSVP / Form account (see
 * features/auth/actions.ts's getCurrentSupabaseUser(), which is what
 * distinguishes this from "no session"), or a bare Google sign-in with
 * no product row anywhere. AccountForm's signUp() has no idea a
 * session already exists and fails as "already registered" for the
 * same email — this instead gives the *existing* account a client
 * role scoped to this draft event, i.e. "when they decide to create an
 * event, assign them a client role" for someone who already has an
 * identity on the platform.
 *
 * Re-resolves both the draft event (from `token`) and the signed-in
 * user (from the actual server session), never trusting anything the
 * client passed in. If an admins row was created for this id in the
 * meantime (e.g. a race between two tabs), falls back to the same
 * update-only, never-overwrite-an-existing-link path
 * linkDraftEventToExistingAdminAction uses, rather than a conflicting
 * insert.
 */
export async function claimDraftEventAsNewAdminAction(token: string): Promise<AdminActionResult> {
  const event = await requireDraftEvent(token);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You've been signed out — please sign in again." };
  }

  const { data: existingAdmin, error: lookupError } = await supabaseAdmin()
    .from("admins")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: string }>();

  if (lookupError) {
    return { success: false, error: "Something went wrong checking your account." };
  }

  if (existingAdmin?.role === "owner") {
    return {
      success: false,
      error: "You're signed in as the site owner. Sign out first to set this event up under the host's own account.",
    };
  }
  if (existingAdmin) {
    const linked = await addDraftToAccount(user.id, event.id);
    if (!linked.success) return linked;
  } else {
    const meta = user.user_metadata as { full_name?: string; name?: string } | null;
    const { error: insertError } = await supabaseAdmin().from("admins").insert({
      id: user.id,
      email: user.email ?? "",
      name: meta?.full_name ?? meta?.name ?? user.email ?? "Host",
      role: "client",
      event_id: event.id,
    });
    if (insertError) {
      return { success: false, error: "Something went wrong setting up your account for this event." };
    }
  }

  redirect(wizardStepHref(token, "payment"));
}

/** Thin `<form action={...}>`-compatible wrapper around claimDraftEventAsNewAdminAction — see linkDraftEventFormAction's doc comment, same reasoning. */
export async function claimDraftEventFormAction(token: string): Promise<void> {
  const result = await claimDraftEventAsNewAdminAction(token);
  if (!result.success) {
    redirect(`${wizardStepHref(token, "account")}?linkError=${encodeURIComponent(result.error)}`);
  }
}
