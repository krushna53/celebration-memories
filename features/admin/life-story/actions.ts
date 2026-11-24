"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { UploadValidationError } from "@/services/uploads";
import {
  confirmLifeStoryPhoto,
  countFilmRenders,
  createLifeStoryPhotoUpload,
  deleteLifeStoryPhoto,
  filmUrl,
  getLifeStory,
  getWritingStatus,
  reorderLifeStoryPhotos,
  rotateShareToken,
  saveLifeStoryChapters,
  saveLifeStoryScenes,
  startFilmRender,
  startStructuring,
  tickFilmRender,
  updateLifeStory,
  updateLifeStoryPhoto,
} from "@/services/life-story";
import {
  isLifeStoryLanguage,
  isLifeStoryMotion,
  isLifeStoryMusic,
  LIFE_STORY_MAX_SCENES,
  LIFE_STORY_MAX_STORY_CHARS,
  LIFE_STORY_MIN_STORY_CHARS,
} from "@/lib/life-story";
import type { LifeStory, LifeStoryChapter, LifeStoryPhoto, LifeStoryRender, LifeStoryScene } from "@/types/life-story";

/**
 * Life Story Server Actions (/admin/life-story). Every action re-checks
 * requireAdminForEvent(eventId) and the service layer scopes every query by
 * that event, so an id from the browser can never reach another event.
 * The paid steps (AI writing, film render) are capped per event for
 * client-role hosts (life_stories.structure_limit / film_render_limit);
 * the platform owner is exempt.
 */

type Result<T = undefined> = T extends undefined ? { success: true } | { success: false; error: string } : { success: true; data: T } | { success: false; error: string };

const PAGE = "/admin/life-story";

function failure(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof UploadValidationError) return { success: false, error: err.message };
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

export async function saveStoryAction(
  eventId: string,
  values: { subjectName: string; title: string; subtitle: string; lifeSpan: string; storyText: string; storySource: "paste" | "docx" },
): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    if (!values.subjectName.trim()) return { success: false, error: "Add the name of the person this story is about." };
    if (values.storyText.length > LIFE_STORY_MAX_STORY_CHARS) {
      return { success: false, error: `The story is too long (${LIFE_STORY_MAX_STORY_CHARS.toLocaleString()} characters max).` };
    }
    await updateLifeStory(eventId, {
      subjectName: values.subjectName.trim().slice(0, 120),
      title: values.title.trim().slice(0, 160),
      subtitle: values.subtitle.trim().slice(0, 200),
      lifeSpan: values.lifeSpan.trim().slice(0, 60),
      storyText: values.storyText,
      storySource: values.storySource === "docx" ? "docx" : "paste",
    });
    revalidatePath(PAGE);
    return { success: true };
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
    return { success: true, data: await createLifeStoryPhotoUpload({ eventId, contentType, fileSize }) };
  } catch (err) {
    return failure(err, "Couldn't start the upload.");
  }
}

export async function confirmPhotoUploadAction(
  eventId: string,
  upload: { path: string; fileSize: number; width: number | null; height: number | null; caption: string },
): Promise<Result<LifeStoryPhoto>> {
  try {
    await requireAdminForEvent(eventId);
    return { success: true, data: await confirmLifeStoryPhoto({ eventId, ...upload }) };
  } catch (err) {
    return failure(err, "Couldn't save the photo.");
  }
}

export async function updatePhotoAction(eventId: string, photoId: string, values: { caption?: string; yearLabel?: string; chapterId?: string | null }): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await updateLifeStoryPhoto(eventId, photoId, values);
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the photo.");
  }
}

export async function reorderPhotosAction(eventId: string, orderedIds: string[]): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await reorderLifeStoryPhotos(eventId, orderedIds.slice(0, 500));
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't reorder the photos.");
  }
}

export async function setCoverPhotoAction(eventId: string, photoId: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await updateLifeStory(eventId, { coverPhotoId: photoId });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't set the cover photo.");
  }
}

export async function deletePhotoAction(eventId: string, photoId: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await deleteLifeStoryPhoto(eventId, photoId);
    return { success: true };
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
    const story = await getLifeStory(eventId);
    if (!story) return { success: false, error: "Life story not found." };
    if (story.storyText.trim().length < LIFE_STORY_MIN_STORY_CHARS) {
      return { success: false, error: "Add the story first — at least a few paragraphs." };
    }
    if (admin.role === "client" && story.structureRuns >= story.structureLimit) {
      return { success: false, error: `You've used all ${story.structureLimit} AI writing runs for this event. You can still edit everything by hand.` };
    }
    await startStructuring(eventId);
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't start writing.");
  }
}

/** Polled by the editor while the AI is writing. */
export async function getWritingStatusAction(eventId: string): Promise<Result<Pick<LifeStory, "structureStatus" | "structureError">>> {
  try {
    await requireAdminForEvent(eventId);
    return { success: true, data: await getWritingStatus(eventId) };
  } catch (err) {
    return failure(err, "Couldn't check progress.");
  }
}

export async function saveChaptersAction(eventId: string, chapters: Omit<LifeStoryChapter, "sortOrder">[]): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    if (chapters.length > 30) return { success: false, error: "That's a lot of chapters — 30 at most." };
    await saveLifeStoryChapters(eventId, chapters);
    revalidatePath(PAGE);
    return { success: true };
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
