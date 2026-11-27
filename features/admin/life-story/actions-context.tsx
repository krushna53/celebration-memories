"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  confirmPhotoUploadAction,
  deletePhotoAction,
  getWritingStatusAction,
  reorderPhotosAction,
  requestPhotoUploadAction,
  saveChaptersAction,
  saveStoryAction,
  setCoverPhotoAction,
  startWritingAction,
  updatePhotoAction,
} from "@/features/admin/life-story/actions";

/**
 * The story, photo and AI-writing actions the Life Story panels call. The
 * dashboard (/admin/life-story) uses the admin actions below by default;
 * the wizard's Biography steps wrap the same panels in a provider with the
 * draft-token versions bound to the draft (features/start/actions/
 * life-story.ts) — same "actions prop" idea as TimelineManager.
 */
export interface LifeStoryActions {
  saveStory: typeof saveStoryAction;
  requestPhotoUpload: typeof requestPhotoUploadAction;
  confirmPhotoUpload: typeof confirmPhotoUploadAction;
  updatePhoto: typeof updatePhotoAction;
  reorderPhotos: typeof reorderPhotosAction;
  setCoverPhoto: typeof setCoverPhotoAction;
  deletePhoto: typeof deletePhotoAction;
  startWriting: typeof startWritingAction;
  getWritingStatus: typeof getWritingStatusAction;
  saveChapters: typeof saveChaptersAction;
}

const ADMIN_ACTIONS: LifeStoryActions = {
  saveStory: saveStoryAction,
  requestPhotoUpload: requestPhotoUploadAction,
  confirmPhotoUpload: confirmPhotoUploadAction,
  updatePhoto: updatePhotoAction,
  reorderPhotos: reorderPhotosAction,
  setCoverPhoto: setCoverPhotoAction,
  deletePhoto: deletePhotoAction,
  startWriting: startWritingAction,
  getWritingStatus: getWritingStatusAction,
  saveChapters: saveChaptersAction,
};

const LifeStoryActionsContext = createContext<LifeStoryActions>(ADMIN_ACTIONS);

export function LifeStoryActionsProvider({ actions, children }: { actions: LifeStoryActions; children: ReactNode }) {
  return <LifeStoryActionsContext.Provider value={actions}>{children}</LifeStoryActionsContext.Provider>;
}

export function useLifeStoryActions(): LifeStoryActions {
  return useContext(LifeStoryActionsContext);
}
