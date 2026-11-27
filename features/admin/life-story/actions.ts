"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  countFilmRenders,
  filmUrl,
  getLifeStory,
  rotateShareToken,
  saveLifeStoryScenes,
  startFilmRender,
  tickFilmRender,
  updateLifeStory,
} from "@/services/life-story";
import {
  confirmPhotoUploadCore,
  deletePhotoCore,
  getWritingStatusCore,
  lifeStoryFailure as failure,
  reorderPhotosCore,
  requestPhotoUploadCore,
  saveChaptersCore,
  saveStoryCore,
  setCoverPhotoCore,
  startWritingCore,
  updatePhotoCore,
  type LifeStoryResult as Result,
  type PhotoUpload,
  type PhotoValues,
  type StoryValues,
} from "@/features/life-story/story-actions-core";
import { isLifeStoryLanguage, isLifeStoryMotion, isLifeStoryMusic, LIFE_STORY_MAX_SCENES } from "@/lib/life-story";
import type { LifeStory, LifeStoryChapter, LifeStoryPhoto, LifeStoryRender, LifeStoryScene } from "@/types/life-story";

/**
 * Life Story Server Actions (/admin/life-story). Every action re-checks
 * requireAdminForEvent(eventId) and the service layer scopes every query by
 * that event, so an id from the browser can never reach another event.
 * The paid steps (AI writing, film render) are capped per event for
 * client-role hosts (life_stories.structure_limit / film_render_limit);
 * the platform owner is exempt.
 */

const PAGE = "/admin/life-story";

export async function saveStoryAction(eventId: string, values: StoryValues): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    const result = await saveStoryCore(eventId, values);
    if (result.success) revalidatePath(PAGE);
    return result;
  } catch (err) {
    return failure(err, "Couldn't save the story.");
  }
}

export async function saveFilmSettingsAction(eventId: string, values: { narrationLanguage: string; music: string }): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    if (!isLifeStoryLanguage(values.narrationLanguage) || !isLifeStoryMusic(values.music)) return { success: false, error: "Pick a language and music track." };
    await updateLifeStory(eventId, { narrationLanguage: values.narrationLanguage, music: values.music });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the film settings.");
  }
}

export async function setSharingAction(eventId: string, isShared: boolean): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await updateLifeStory(eventId, { isShared });
    revalidatePath(PAGE);
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't change sharing.");
  }
}

export async function resetShareLinkAction(eventId: string): Promise<Result<{ shareToken: string }>> {
  try {
    await requireAdminForEvent(eventId);
    await rotateShareToken(eventId);
    const story = await getLifeStory(eventId);
    revalidatePath(PAGE);
    return { success: true, data: { shareToken: story!.shareToken } };
  } catch (err) {
    return failure(err, "Couldn't reset the link.");
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function requestPhotoUploadAction(eventId: string, contentType: string, fileSize: number): Promise<Result<{ path: string; token: string }>> {
  try {
    await requireAdminForEvent(eventId);
    return await requestPhotoUploadCore(eventId, contentType, fileSize);
  } catch (err) {
    return failure(err, "Couldn't start the upload.");
  }
}

export async function confirmPhotoUploadAction(eventId: string, upload: PhotoUpload): Promise<Result<LifeStoryPhoto>> {
  try {
    await requireAdminForEvent(eventId);
    return await confirmPhotoUploadCore(eventId, upload);
  } catch (err) {
    return failure(err, "Couldn't save the photo.");
  }
}

export async function updatePhotoAction(eventId: string, photoId: string, values: PhotoValues): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    return await updatePhotoCore(eventId, photoId, values);
  } catch (err) {
    return failure(err, "Couldn't save the photo.");
  }
}

export async function reorderPhotosAction(eventId: string, orderedIds: string[]): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    return await reorderPhotosCore(eventId, orderedIds);
  } catch (err) {
    return failure(err, "Couldn't reorder the photos.");
  }
}

export async function setCoverPhotoAction(eventId: string, photoId: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    return await setCoverPhotoCore(eventId, photoId);
  } catch (err) {
    return failure(err, "Couldn't set the cover photo.");
  }
}

export async function deletePhotoAction(eventId: string, photoId: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    return await deletePhotoCore(eventId, photoId);
  } catch (err) {
    return failure(err, "Couldn't delete the photo.");
  }
}

// ---------------------------------------------------------------------------
// AI writing
// ---------------------------------------------------------------------------

export async function startWritingAction(eventId: string): Promise<Result> {
  try {
    const admin = await requireAdminForEvent(eventId);
    return await startWritingCore(eventId, admin.role === "client");
  } catch (err) {
    return failure(err, "Couldn't start writing.");
  }
}

/** Polled by the editor while the AI is writing. */
export async function getWritingStatusAction(eventId: string): Promise<Result<Pick<LifeStory, "structureStatus" | "structureError">>> {
  try {
    await requireAdminForEvent(eventId);
    return await getWritingStatusCore(eventId);
  } catch (err) {
    return failure(err, "Couldn't check progress.");
  }
}

export async function saveChaptersAction(eventId: string, chapters: Omit<LifeStoryChapter, "sortOrder">[], dedication?: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    const result = await saveChaptersCore(eventId, chapters, dedication);
    if (result.success) revalidatePath(PAGE);
    return result;
  } catch (err) {
    return failure(err, "Couldn't save the chapters.");
  }
}

export async function saveScenesAction(eventId: string, scenes: Omit<LifeStoryScene, "sortOrder">[]): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    if (scenes.length > LIFE_STORY_MAX_SCENES) return { success: false, error: `A film can have up to ${LIFE_STORY_MAX_SCENES} scenes.` };
    if (scenes.some((s) => !isLifeStoryMotion(s.motion))) return { success: false, error: "Unknown camera motion." };
    await saveLifeStoryScenes(eventId, scenes);
    revalidatePath(PAGE);
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the film script.");
  }
}

// ---------------------------------------------------------------------------
// Film
// ---------------------------------------------------------------------------

export async function startFilmAction(eventId: string): Promise<Result<{ renderId: string }>> {
  try {
    const admin = await requireAdminForEvent(eventId);
    const story = await getLifeStory(eventId);
    if (!story) return { success: false, error: "Life story not found." };
    if (admin.role === "client" && (await countFilmRenders(story.id)) >= story.filmRenderLimit) {
      return { success: false, error: `You've made ${story.filmRenderLimit} films for this event — the limit. Contact us to raise it.` };
    }
    return { success: true, data: { renderId: await startFilmRender(eventId, admin.id) } };
  } catch (err) {
    return failure(err, "Couldn't start the film.");
  }
}

export async function tickFilmAction(eventId: string, renderId: string): Promise<Result<{ render: LifeStoryRender; url: string | null }>> {
  try {
    await requireAdminForEvent(eventId);
    const render = await tickFilmRender(eventId, renderId);
    return { success: true, data: { render, url: filmUrl(render) } };
  } catch (err) {
    return failure(err, "Couldn't check the film.");
  }
}
