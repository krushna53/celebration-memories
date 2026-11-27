import type { LifeStoryLanguage, LifeStoryMotion, LifeStoryMusic } from "@/types/life-story";

/**
 * Life Story — shared constants for the admin editor, the public page and
 * the Server Actions. The heavy lifting lives in the life-story Edge
 * Function; see services/life-story.ts for the overall flow.
 */

export const LIFE_STORY_MOTIONS: Record<LifeStoryMotion, string> = {
  zoom_in: "Slow zoom in",
  zoom_out: "Slow zoom out",
  pan_left: "Pan left",
  pan_right: "Pan right",
};

export const LIFE_STORY_LANGUAGES: Record<LifeStoryLanguage, string> = {
  english: "English",
  hindi: "Hindi",
  gujarati: "Gujarati",
  hinglish: "Hinglish",
};

/** Keys mirror the MUSIC map in supabase/functions/life-story/index.ts (the function resolves the URL itself). */
export const LIFE_STORY_MUSIC: Record<LifeStoryMusic, string> = {
  heartfelt: "Heartfelt — warm & gentle",
  cinematic: "Cinematic — sweeping & emotional",
  celebration: "Celebration — upbeat & bright",
  none: "No music",
};

export const LIFE_STORY_MAX_STORY_CHARS = 200_000;
export const LIFE_STORY_MIN_STORY_CHARS = 200;
export const LIFE_STORY_MAX_PHOTOS = 120;
export const LIFE_STORY_MAX_SCENES = 40;
/** Must match LIFE_STORY_MAX_ANIMATED_SCENES' default in the Edge Function. */
export const LIFE_STORY_MAX_ANIMATED = 6;
/** Photos are re-encoded to JPEG in the browser before upload (lib/image-compression.ts). */
export const LIFE_STORY_PHOTO_MAX_EDGE = 2400;
export const LIFE_STORY_PHOTO_MAX_BYTES = 25 * 1024 * 1024;

export function isLifeStoryMotion(value: string): value is LifeStoryMotion {
  return value in LIFE_STORY_MOTIONS;
}
export function isLifeStoryLanguage(value: string): value is LifeStoryLanguage {
  return value in LIFE_STORY_LANGUAGES;
}
export function isLifeStoryMusic(value: string): value is LifeStoryMusic {
  return value in LIFE_STORY_MUSIC;
}

/** Split stored chapter text into paragraphs (blank-line separated). */
export function storyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Rough film length estimate for the editor, before any voiceover exists (~2.6 spoken words/sec). */
export function estimateFilmSeconds(narrations: string[]): number {
  const words = narrations.reduce((sum, n) => sum + n.trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.round(10 + words / 2.6 + narrations.length * 1.4);
}
