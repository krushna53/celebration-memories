"use server";

import { getInviteeByToken } from "@/services/invitees";
import { submitGuestbookEntry } from "@/services/guestbook";
import { logActivity } from "@/services/tracking";
import { guestbookFormSchema, type GuestbookFormValues } from "@/types/guestbook";

export type GuestbookResult = { success: true } | { success: false; error: string };

export async function submitGuestbookAction(
  token: string,
  values: GuestbookFormValues,
  photoPath: string | null,
): Promise<GuestbookResult> {
  const parsed = guestbookFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    await submitGuestbookEntry({
      inviteeId: found.invitee.id,
      eventId: found.event.id,
      values: parsed.data,
      photoPath,
    });
    await logActivity(found.invitee.id, "guestbook_submitted");
  } catch (err) {
    console.error("submitGuestbookAction failed:", err);
    return { success: false, error: "Could not save your message. Please try again." };
  }

  return { success: true };
}
