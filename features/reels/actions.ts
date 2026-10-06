"use server";

import { revalidatePath } from "next/cache";

import { getInviteeByToken } from "@/services/invitees";
import { UploadValidationError } from "@/services/uploads";
import { areGuestReelsEnabled, createSignedReelFaceUpload, setInviteeReelPhoto } from "@/services/guest-reels";

/**
 * A guest's own Guest Reel opt-in — the selfie used to find them in the
 * event's photos. Token-gated like everything guest-facing: the invitee
 * is always re-resolved from the invite token, never from a client id.
 */

export type RequestReelSelfieUploadResult =
  | { success: true; data: { bucket: string; path: string; token: string; signedUrl: string; viewUrl: string } }
  | { success: false; error: string };

export async function requestReelSelfieUploadAction(
  token: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestReelSelfieUploadResult> {
  try {
    const found = await getInviteeByToken(token);
    if (!found) return { success: false, error: "This invitation link is not valid." };
    if (!(await areGuestReelsEnabled(found.event.id))) return { success: false, error: "Reels aren't turned on for this event." };
    const data = await createSignedReelFaceUpload({
      eventId: found.event.id,
      owner: found.invitee.id,
      fileName,
      contentType,
      fileSize,
      audience: "guest",
    });
    return { success: true, data };
  } catch (err) {
    if (err instanceof UploadValidationError) return { success: false, error: err.message };
    console.error("requestReelSelfieUploadAction failed:", err);
    return { success: false, error: "Couldn't start the upload. Please try again." };
  }
}

/** `path` null = withdraw consent (removes the selfie and every match). A path is only accepted with consent ticked. */
export async function saveReelSelfieAction(
  token: string,
  path: string | null,
  consent: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const found = await getInviteeByToken(token);
    if (!found) return { success: false, error: "This invitation link is not valid." };
    if (path && !consent) return { success: false, error: "Please tick the box to agree first." };
    await setInviteeReelPhoto({ eventId: found.event.id, inviteeId: found.invitee.id, path, source: "guest" });
    revalidatePath(`/invite/${token}`);
    return { success: true };
  } catch (err) {
    console.error("saveReelSelfieAction failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Couldn't save your photo." };
  }
}
