"use server";

import { getInviteeByToken } from "@/services/invitees";
import {
  confirmMediaUpload,
  createSignedMediaUpload,
  deleteOwnMediaUpload,
  UploadValidationError,
} from "@/services/uploads";
import { logActivity } from "@/services/tracking";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Step 1 of a guest upload: re-resolves the invitee from their token
 * (never trusts a client-supplied id) and mints a signed Storage upload
 * URL the browser can PUT the file to directly.
 */
export async function requestUploadUrl(
  token: string,
  kind: "photo" | "video" | "audio",
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<ActionResult<{ bucket: string; path: string; token: string; signedUrl: string }>> {
  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    const upload = await createSignedMediaUpload({
      inviteeId: found.invitee.id,
      eventId: found.event.id,
      kind,
      fileName,
      contentType,
      fileSize,
    });
    return { success: true, data: upload };
  } catch (err) {
    const message =
      err instanceof UploadValidationError
        ? err.message
        : "Could not prepare the upload. Please try again.";
    if (!(err instanceof UploadValidationError)) {
      console.error("requestUploadUrl failed:", err);
    }
    return { success: false, error: message };
  }
}

/**
 * Step 2: called once the browser's direct-to-Storage PUT succeeds.
 * Records the row (pending admin approval) in photos/videos/audio.
 * Returns the new row's id so the guest's own upload queue can offer a
 * "Delete" option afterward (see deleteUploadAction below) without any
 * other endpoint needing to expose that id more broadly.
 */
export async function confirmUpload(
  token: string,
  kind: "photo" | "video" | "audio",
  path: string,
  caption: string,
): Promise<ActionResult<{ id: string }>> {
  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    const { id } = await confirmMediaUpload({
      inviteeId: found.invitee.id,
      eventId: found.event.id,
      kind,
      path,
      caption,
    });
    await logActivity(found.invitee.id, `${kind}_uploaded`);
    return { success: true, data: { id } };
  } catch (err) {
    console.error("confirmUpload failed:", err);
    return { success: false, error: "Could not save your upload. Please try again." };
  }
}

/**
 * Lets a guest delete a photo/video/audio memory they just uploaded
 * through this same token — "Delete" next to an already-uploaded item
 * in the queue, e.g. to record a video again after seeing the preview.
 * Re-resolves the invitee from the token (never trusts a client-
 * supplied invitee id) and ownership is enforced again inside
 * deleteOwnMediaUpload itself.
 */
export async function deleteUploadAction(
  token: string,
  kind: "photo" | "video" | "audio",
  mediaId: string,
): Promise<ActionResult<true>> {
  const found = await getInviteeByToken(token);
  if (!found) {
    return { success: false, error: "This invitation link is not valid." };
  }

  try {
    await deleteOwnMediaUpload({ inviteeId: found.invitee.id, kind, mediaId });
    return { success: true, data: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete that upload.";
    return { success: false, error: message };
  }
}
