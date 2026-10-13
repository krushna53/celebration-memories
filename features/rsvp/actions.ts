"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getInviteeByToken } from "@/services/invitees";
import { submitRsvp } from "@/services/rsvps";
import { sendRsvpConfirmation } from "@/lib/email";
import { buildRsvpSchema, pickAnswers } from "@/lib/rsvp-config";
import { getRsvpConfig } from "@/services/rsvp-config";
import type { ConfiguredRsvpValues } from "@/features/rsvp/rsvp-config-fields";
import { notifyAdminsOfRsvpSubmission } from "@/services/admin-notifications";

export type SubmitRsvpResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Server Action backing the RSVP form. Re-resolves the invitee from the
 * token server-side (never trusts a client-supplied invitee id), so the
 * only thing a guest can authenticate with is the token embedded in
 * their unique invitation link.
 */
export async function submitRsvpAction(
  token: string,
  values: ConfiguredRsvpValues,
): Promise<SubmitRsvpResult> {
  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  // Validated against this event's own RSVP form setup (required fields, custom questions).
  const config = await getRsvpConfig(found.event.id);
  const parsed = buildRsvpSchema(config).safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  try {
    await submitRsvp(found.invitee.id, parsed.data, config.questions.length > 0 ? pickAnswers(config, parsed.data.answers) : undefined);
  } catch (err) {
    console.error("submitRsvpAction failed:", err);
    return {
      success: false,
      error: "Something went wrong saving your RSVP. Please try again.",
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");

  if (parsed.data.email) {
    const eventUrl = host ? `https://${host}/invite/${token}` : `/invite/${token}`;
    // Best-effort — a failed confirmation email should never fail the RSVP itself.
    sendRsvpConfirmation({
      guestEmail: parsed.data.email,
      guestName: parsed.data.name,
      honoreeName: found.event.honoreeName,
      eventTitle: found.event.eventTitle,
      coming: parsed.data.coming,
      eventUrl,
    }).catch((err) => console.error("sendRsvpConfirmation failed:", err));
  }

  // Let the event's admin(s) — the client host and the owner — know an
  // RSVP just came in, both as an in-app notification and by email.
  // Entirely best-effort: never lets a notification/email failure fail
  // the RSVP itself, which is already saved by this point.
  notifyAdminsOfRsvpSubmission({
    eventId: found.event.id,
    honoreeName: found.event.honoreeName,
    eventTitle: found.event.eventTitle,
    values: parsed.data,
    host,
  }).catch((err) => console.error("notifyAdminsOfRsvpSubmission failed:", err));

  revalidatePath(`/invite/${token}`);
  return { success: true };
}
