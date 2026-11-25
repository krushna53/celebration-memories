"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import {
  confirmPhotoUploadCore,
  deletePhotoCore,
  getWritingStatusCore,
  lifeStoryFailure,
  reorderPhotosCore,
  requestPhotoUploadCore,
  saveChaptersCore,
  saveStoryCore,
  setCoverPhotoCore,
  startWritingCore,
  updatePhotoCore,
  type LifeStoryResult,
  type PhotoUpload,
  type PhotoValues,
  type StoryValues,
} from "@/features/life-story/story-actions-core";
import type { LifeStory, LifeStoryChapter, LifeStoryPhoto } from "@/types/life-story";

/**
 * Draft-token-gated mirrors of the Life Story actions, for the wizard's
 * Biography steps (app/start/[token]/story + /book). Each takes the draft
 * token first — bound by the step's Server Component, see
 * features/start/draft-auth.ts — and only ever acts on the event that token
 * resolves to. AI writing is always capped (a draft has no owner exemption).
 */

async function draft<R>(token: string, eventId: string, run: () => Promise<R>, fallback: string): Promise<R | { success: false; error: string }> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    return await run();
  } catch (err) {
    return lifeStoryFailure(err, fallback);
  }
}

export async function draftSaveStoryAction(token: string, eventId: string, values: StoryValues): Promise<LifeStoryResult> {
  return draft(token, eventId, () => saveStoryCore(eventId, values), "Couldn't save the story.");
}

export async function draftRequestStoryPhotoUploadAction(
  token: string,
  eventId: string,
  contentType: string,
  fileSize: number,
): Promise<LifeStoryResult<{ path: string; token: string }>> {
  return draft(token, eventId, () => requestPhotoUploadCore(eventId, contentType, fileSize), "Couldn't start the upload.");
}

export async function draftConfirmStoryPhotoUploadAction(token: string, eventId: string, upload: PhotoUpload): Promise<LifeStoryResult<LifeStoryPhoto>> {
  return draft(token, eventId, () => confirmPhotoUploadCore(eventId, upload), "Couldn't save the photo.");
}

export async function draftUpdateStoryPhotoAction(token: string, eventId: string, photoId: string, values: PhotoValues): Promise<LifeStoryResult> {
  return draft(token, eventId, () => updatePhotoCore(eventId, photoId, values), "Couldn't save the photo.");
}

export async function draftReorderStoryPhotosAction(token: string, eventId: string, orderedIds: string[]): Promise<LifeStoryResult> {
  return draft(token, eventId, () => reorderPhotosCore(eventId, orderedIds), "Couldn't reorder the photos.");
}

export async function draftSetStoryCoverPhotoAction(token: string, eventId: string, photoId: string): Promise<LifeStoryResult> {
  return draft(token, eventId, () => setCoverPhotoCore(eventId, photoId), "Couldn't set the cover photo.");
}

export async function draftDeleteStoryPhotoAction(token: string, eventId: string, photoId: string): Promise<LifeStoryResult> {
  return draft(token, eventId, () => deletePhotoCore(eventId, photoId), "Couldn't delete the photo.");
}

export async function draftStartWritingAction(token: string, eventId: string): Promise<LifeStoryResult> {
  return draft(token, eventId, () => startWritingCore(eventId, true), "Couldn't start writing.");
}

export async function draftGetWritingStatusAction(
  token: string,
  eventId: string,
): Promise<LifeStoryResult<Pick<LifeStory, "structureStatus" | "structureError">>> {
  return draft(token, eventId, () => getWritingStatusCore(eventId), "Couldn't check progress.");
}

export async function draftSaveChaptersAction(
  token: string,
  eventId: string,
  chapters: Omit<LifeStoryChapter, "sortOrder">[],
  dedication?: string,
): Promise<LifeStoryResult> {
  return draft(token, eventId, () => saveChaptersCore(eventId, chapters, dedication), "Couldn't save the chapters.");
}
