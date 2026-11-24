export type LifeStoryStructureStatus = "idle" | "processing" | "done" | "error";
export type LifeStoryMotion = "zoom_in" | "zoom_out" | "pan_left" | "pan_right";
export type LifeStoryRenderStatus = "preparing" | "animating" | "submitting" | "rendering" | "done" | "error";
export type LifeStoryLanguage = "english" | "hindi" | "gujarati" | "hinglish";
export type LifeStoryMusic = "heartfelt" | "cinematic" | "celebration" | "none";

export interface LifeStory {
  id: string;
  eventId: string;
  subjectName: string;
  title: string;
  subtitle: string;
  lifeSpan: string;
  storyText: string;
  storySource: "paste" | "docx";
  narrationLanguage: LifeStoryLanguage;
  music: LifeStoryMusic;
  structureStatus: LifeStoryStructureStatus;
  structureError: string | null;
  structuredAt: string | null;
  coverPhotoId: string | null;
  shareToken: string;
  isShared: boolean;
  structureLimit: number;
  structureRuns: number;
  filmRenderLimit: number;
}

export interface LifeStoryChapter {
  id: string;
  sortOrder: number;
  title: string;
  period: string;
  body: string;
}

export interface LifeStoryPhoto {
  id: string;
  chapterId: string | null;
  storagePath: string;
  width: number | null;
  height: number | null;
  caption: string;
  yearLabel: string;
  sortOrder: number;
  /** Signed /media link (lib/media-url.ts). */
  url: string;
}

export interface LifeStoryScene {
  id: string;
  photoId: string | null;
  sortOrder: number;
  narration: string;
  caption: string;
  motion: LifeStoryMotion;
  animate: boolean;
  animationPrompt: string;
}

export interface LifeStoryRender {
  id: string;
  status: LifeStoryRenderStatus;
  progressNote: string;
  resultPath: string | null;
  durationSeconds: number | null;
  xaiCostUsd: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface LifeStoryBundle {
  story: LifeStory;
  chapters: LifeStoryChapter[];
  photos: LifeStoryPhoto[];
  scenes: LifeStoryScene[];
  latestRender: LifeStoryRender | null;
  /** Newest finished film (may be older than latestRender), as a signed /media link. */
  film: { url: string; durationSeconds: number | null } | null;
}
