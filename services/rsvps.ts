import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RsvpFormValues } from "@/types/rsvp";
import { logActivity } from "@/services/tracking";

/**
 * Creates or updates a guest's RSVP (one row per invitee — resubmitting
 * updates in place) and keeps `invitees.rsvp_status` in sync so admin
 * dashboard queries don't need to join against `rsvps` for the common
 * case of "what's this guest's current status".
 */
export async function submitRsvp(inviteeId: string, values: RsvpFormValues) {
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
