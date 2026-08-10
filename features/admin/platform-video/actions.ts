"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { createSignedPlatformVideoUpload, publicMediaUrl } from "@/services/uploads";
import {
  updatePlatformVideoSettings,
  type FeatureVideoSourceType,
} from "@/services/platform-video-settings";

export type PlatformVideoActionResult = { success: true } | { success: false; error: string };

/** Owner-only — mints a signed Storage upload URL for a new feature-video file. */
export async function requestPlatformVideoUploadUrlAction(
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<
  | { success: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { success: false; error: string }
> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedPlatformVideoUpload({ fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start upload." };
  }
}

/**
 * Called right after the browser's PUT to the signed URL succeeds —
 * resolves the Storage path into a public URL so the form can preview
 * it immediately. Doesn't write to the DB yet; that only happens when
 * the owner clicks Save (savePlatformVideoAction), so an abandoned
 * upload never silently goes live.
 */
export async function resolvePlatformVideoUploadAction(
  path: string,
): Promise<{ success: true; data: { url: string } } | { success: false; error: string }> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  return { success: true, data: { url: publicMediaUrl("videos", path) } };
}

export interface SavePlatformVideoInput {
  enabled: boolean;
  sourceType: FeatureVideoSourceType;
  videoUrl: string | null;
  storagePath: string | null;
  title: string | null;
}

/** Owner-only — persists the feature video settings shown on the public homepage. */
export async function savePlatformVideoAction(input: SavePlatformVideoInput): Promise<PlatformVideoActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  if (input.enabled) {
    if (input.sourceType === "link" && !input.videoUrl?.trim()) {
      return { success: false, error: "Paste a video link, or switch to Upload and add a file." };
    }
    if (input.sourceType === "upload" && !input.storagePath) {
      return { success: false, error: "Upload a video file first." };
    }
  }

  try {
    await updatePlatformVideoSettings({
      enabled: input.enabled,
      sourceType: input.sourceType,
      videoUrl: input.sourceType === "link" ? input.videoUrl?.trim() || null : input.videoUrl,
      storagePath: input.sourceType === "upload" ? input.storagePath : null,
      title: input.title?.trim() || null,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidatePath("/");
  revalidatePath("/admin/platform-video");
  return { success: true };
}
