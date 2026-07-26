"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getInviteeByToken } from "@/services/invitees";
import { submitRsvp } from "@/services/rsvps";
import { sendRsvpConfirmation } from "@/lib/email";
import { rsvpFormSchema, type RsvpFormValues } from "@/types/rsvp";

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
  values: RsvpFormValues,
): Promise<SubmitRsvpResult> {
  const parsed = rsvpFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    await submitRsvp(found.invitee.id, parsed.data);
  } catch (err) {
    console.error("submitRsvpAction failed:", err);
    return {
      success: false,
      error: "Something went wrong saving your RSVP. Please try again.",
    };
  }

  if (parsed.data.email) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
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

  revalidatePath(`/invite/${token}`);
  return { success: true };
}
