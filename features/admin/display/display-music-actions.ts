"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { setDisplayMusic } from "@/services/display-music";
import { createSignedSlideshowMusicUpload, UploadValidationError } from "@/services/uploads";

/** Big Screen Display music — see services/display-music.ts. */

export async function setDisplayMusicAction(eventId: string, choice: string, path: string | null) {
  try {
    await requireAdminForEvent(eventId);
    await setDisplayMusic(eventId, choice, path);
    revalidatePath("/admin");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Signed upload for the host's own song — same audio storage and limits as the Slideshow Video's music. */
export async function requestDisplayMusicUploadAction(eventId: string, fileName: string, contentType: string, fileSize: number) {
  try {
    await requireAdminForEvent(eventId);
    const upload = await createSignedSlideshowMusicUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: { bucket: upload.bucket, path: upload.path, token: upload.token } };
  } catch (err) {
    const message = err instanceof UploadValidationError || err instanceof Error ? err.message : "Upload failed.";
    return { success: false as const, error: message };
  }
}
