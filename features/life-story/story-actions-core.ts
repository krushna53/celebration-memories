import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateEvent } from "@/services/events";
import { UploadValidationError } from "@/services/uploads";
import {
  confirmLifeStoryPhoto,
  createLifeStoryPhotoUpload,
  deleteLifeStoryPhoto,
  getLifeStory,
  getWritingStatus,
  reorderLifeStoryPhotos,
  saveLifeStoryChapters,
  startStructuring,
  updateLifeStory,
  updateLifeStoryPhoto,
} from "@/services/life-story";
import { LIFE_STORY_MAX_STORY_CHARS, LIFE_STORY_MIN_STORY_CHARS } from "@/lib/life-story";
import type { LifeStory, LifeStoryChapter, LifeStoryPhoto } from "@/types/life-story";

/**
 * The story / photos / AI-writing steps of a Life Story, shared by the two
 * places that edit one: /admin/life-story (features/admin/life-story/
 * actions.ts, after requireAdminForEvent) and the wizard's Biography steps
 * (features/start/actions/life-story.ts, after requireDraftEvent). Callers
 * do the auth check first; everything here is scoped by that eventId.
 * `capped` applies the per-event AI writing limit (client hosts and drafts —
 * the platform owner is exempt).
 */

export type LifeStoryResult<T = undefined> = T extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: T } | { success: false; error: string };

export interface StoryValues {
  subjectName: string;
  title: string;
  subtitle: string;
  lifeSpan: string;
  storyText: string;
  storySource: "paste" | "docx";
}

export type PhotoUpload = { path: string; fileSize: number; width: number | null; height: number | null; caption: string };
export type PhotoValues = { caption?: string; yearLabel?: string; chapterId?: string | null };

export function lifeStoryFailure(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof UploadValidationError) return { success: false, error: err.message };
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

/** A Biography event *is* its book: its honoree and tagline (events.event_title) follow the story. */
async function syncBiographyEvent(eventId: string, values: StoryValues): Promise<void> {
  const { data } = await supabaseAdmin().from("events").select("category").eq("id", eventId).maybeSingle<{ category: string }>();
  if (data?.category !== "biography") return;
  await updateEvent(eventId, {
    honoreeName: values.subjectName.trim().slice(0, 120),
    eventTitle: values.subtitle.trim().slice(0, 200) || "A Biography",
  });
}

export async function saveStoryCore(eventId: string, values: StoryValues): Promise<LifeStoryResult> {
  try {
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
    await syncBiographyEvent(eventId, values);
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't save the story.");
  }
}

export async function requestPhotoUploadCore(eventId: string, contentType: string, fileSize: number): Promise<LifeStoryResult<{ path: string; token: string }>> {
  try {
    return { success: true, data: await createLifeStoryPhotoUpload({ eventId, contentType, fileSize }) };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't start the upload.");
  }
}

export async function confirmPhotoUploadCore(eventId: string, upload: PhotoUpload): Promise<LifeStoryResult<LifeStoryPhoto>> {
  try {
    return { success: true, data: await confirmLifeStoryPhoto({ eventId, ...upload }) };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't save the photo.");
  }
}

export async function updatePhotoCore(eventId: string, photoId: string, values: PhotoValues): Promise<LifeStoryResult> {
  try {
    await updateLifeStoryPhoto(eventId, photoId, values);
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't save the photo.");
  }
}

export async function reorderPhotosCore(eventId: string, orderedIds: string[]): Promise<LifeStoryResult> {
  try {
    await reorderLifeStoryPhotos(eventId, orderedIds.slice(0, 500));
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't reorder the photos.");
  }
}

export async function setCoverPhotoCore(eventId: string, photoId: string): Promise<LifeStoryResult> {
  try {
    await updateLifeStory(eventId, { coverPhotoId: photoId });
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't set the cover photo.");
  }
}

export async function deletePhotoCore(eventId: string, photoId: string): Promise<LifeStoryResult> {
  try {
    await deleteLifeStoryPhoto(eventId, photoId);
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't delete the photo.");
  }
}

export async function startWritingCore(eventId: string, capped: boolean): Promise<LifeStoryResult> {
  try {
    const story = await getLifeStory(eventId);
    if (!story) return { success: false, error: "Life story not found." };
    if (story.storyText.trim().length < LIFE_STORY_MIN_STORY_CHARS) {
      return { success: false, error: "Add the story first — at least a few paragraphs." };
    }
    if (capped && story.structureRuns >= story.structureLimit) {
      return { success: false, error: `You've used all ${story.structureLimit} AI writing runs for this event. You can still edit everything by hand.` };
    }
    await startStructuring(eventId);
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't start writing.");
  }
}

export async function getWritingStatusCore(eventId: string): Promise<LifeStoryResult<Pick<LifeStory, "structureStatus" | "structureError">>> {
  try {
    return { success: true, data: await getWritingStatus(eventId) };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't check progress.");
  }
}

export async function saveChaptersCore(
  eventId: string,
  chapters: Omit<LifeStoryChapter, "sortOrder">[],
  dedication?: string,
): Promise<LifeStoryResult> {
  try {
    if (chapters.length > 30) return { success: false, error: "That's a lot of chapters — 30 at most." };
    await saveLifeStoryChapters(eventId, chapters);
    if (dedication !== undefined) await updateLifeStory(eventId, { dedication: dedication.trim().slice(0, 600) });
    return { success: true };
  } catch (err) {
    return lifeStoryFailure(err, "Couldn't save the chapters.");
  }
}
