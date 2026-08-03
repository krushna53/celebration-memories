"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  confirmVideoEditorUpload,
  deleteVideoEditorUpload,
  saveVideoEditDraft,
  setVideoEditJobLiveOnBigScreen,
} from "@/services/video-editor";
import { createSignedSlideshowMusicUpload, createSignedVideoEditorUpload, UploadValidationError } from "@/services/uploads";

export type RequestVideoEditorUploadResult =
  | { success: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { success: false; error: string };

/** Issues a signed upload URL for a custom video the client wants to bring into the editor — see createSignedVideoEditorUpload. */
export async function requestVideoEditorUploadAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestVideoEditorUploadResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedVideoEditorUpload({ eventId, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    if (err instanceof UploadValidationError) return { success: false, error: err.message };
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type RequestVideoEditorMusicUploadResult =
  | { success: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { success: false; error: string };

/**
 * Issues a signed upload URL for a background-music track on the Video
 * Editor's timeline soundtrack. Reuses createSignedSlideshowMusicUpload
 * (same `audio` Storage bucket, same MIME-type allow-list) rather than
 * a new bucket/service function — this is the identical "an admin
 * uploads one mp3 to loop under a video" need that /admin/slideshow
 * already solved; only the caller differs. There's no DB row for this
 * (unlike video/photo uploads) — the resulting public URL just gets
 * written into the edit JSON's timeline.soundtrack field and saved
 * with the rest of the draft via saveVideoEditDraftAction.
 */
export async function requestVideoEditorMusicUploadAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestVideoEditorMusicUploadResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedSlideshowMusicUpload({ eventId, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    if (err instanceof UploadValidationError) return { success: false, error: err.message };
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type VideoEditorActionResult = { success: true } | { success: false; error: string };

/** Called once the browser's PUT to the signed URL from requestVideoEditorUploadAction succeeds — records the row so it shows up in the media bin. */
export async function confirmVideoEditorUploadAction(
  eventId: string,
  storagePath: string,
  filename: string,
): Promise<VideoEditorActionResult> {
  try {
    const admin = await requireAdminForEvent(eventId);
    await confirmVideoEditorUpload({ eventId, adminId: admin.id, storagePath, filename });
    revalidatePath("/admin/video-editor");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save the upload." };
  }
}

export async function deleteVideoEditorUploadAction(eventId: string, uploadId: string): Promise<VideoEditorActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await deleteVideoEditorUpload(eventId, uploadId);
    revalidatePath("/admin/video-editor");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete the upload." };
  }
}

export type SaveVideoEditDraftResult = { success: true; jobId: string } | { success: false; error: string };

/**
 * Autosaved on an interval while the client works in the Studio SDK
 * editor (see video-editor-workspace.tsx) — the FIRST save creates the
 * job row (jobId starts null) and every save after that updates it in
 * place. Never touches a job that's already rendering/done/error.
 */
export async function saveVideoEditDraftAction(
  eventId: string,
  jobId: string | null,
  title: string,
  editJson: unknown,
): Promise<SaveVideoEditDraftResult> {
  try {
    const admin = await requireAdminForEvent(eventId);
    const savedId = await saveVideoEditDraft({ jobId, eventId, adminId: admin.id, title, editJson });
    return { success: true, jobId: savedId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save your edit." };
  }
}

export async function setBigScreenVideoAction(eventId: string, jobId: string): Promise<VideoEditorActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await setVideoEditJobLiveOnBigScreen(eventId, jobId);
    revalidatePath("/admin/video-editor");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update the Big Screen video." };
  }
}
