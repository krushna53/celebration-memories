"use server";

import { revalidatePath } from "next/cache";

import { getInviteeByToken } from "@/services/invitees";
import { submitRsvp } from "@/services/rsvps";
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

  revalidatePath(`/invite/${token}`);
  return { success: true };
}
