import "server-only";
import { CONSENT_VERSION } from "@/lib/privacy-consent";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RsvpFormValues } from "@/types/rsvp";
import { logActivity } from "@/services/tracking";

/**
 * Creates or updates a guest's RSVP (one row per invitee — resubmitting
 * updates in place) and keeps `invitees.rsvp_status` in sync so admin
 * dashboard queries don't need to join against `rsvps` for the common
 * case of "what's this guest's current status".
 */
export async function submitRsvp(
  inviteeId: string,
  values: RsvpFormValues,
  /** Answers to the event's custom RSVP questions (lib/rsvp-config.ts pickAnswers) — omitted for events without any. */
  answers?: Record<string, string> | null,
) {
  if (values.consent !== true) throw new Error("RSVP consent is required.");
  if (values.consentVersion !== CONSENT_VERSION) throw new Error("Please refresh and review the current privacy notice.");
  const client = supabaseAdmin();

  const { error: rsvpError } = await client.from("rsvps").upsert(
    {
      invitee_id: inviteeId,
      coming: values.coming,
      adults: values.adults,
      children: values.children,
      meal_preference: values.mealPreference,
      comments: values.comments || null,
      submitted_at: new Date().toISOString(),
      consent_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
      ...(answers !== undefined ? { answers } : {}),
    },
    { onConflict: "invitee_id" },
  );

  if (rsvpError) {
    throw new Error(`Failed to save RSVP: ${rsvpError.message}`);
  }

  const { error: inviteeError } = await client
    .from("invitees")
    .update({
      rsvp_status: values.coming,
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
    })
    .eq("id", inviteeId);

  if (inviteeError) {
    throw new Error(`Failed to update invitee status: ${inviteeError.message}`);
  }

  await logActivity(inviteeId, "rsvp_submitted");
}
