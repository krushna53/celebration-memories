import "server-only";

import type { LifeStoryActions } from "@/features/admin/life-story/actions-context";
import {
  draftConfirmStoryPhotoUploadAction,
  draftDeleteStoryPhotoAction,
  draftGetWritingStatusAction,
  draftReorderStoryPhotosAction,
  draftRequestStoryPhotoUploadAction,
  draftSaveChaptersAction,
  draftSaveStoryAction,
  draftSetStoryCoverPhotoAction,
  draftStartWritingAction,
  draftUpdateStoryPhotoAction,
} from "@/features/start/actions/life-story";

/** The draft-token Life Story actions, bound to one draft, in the shape the shared panels take. */
export function draftLifeStoryActions(token: string): LifeStoryActions {
  return {
    saveStory: draftSaveStoryAction.bind(null, token),
    requestPhotoUpload: draftRequestStoryPhotoUploadAction.bind(null, token),
    confirmPhotoUpload: draftConfirmStoryPhotoUploadAction.bind(null, token),
    updatePhoto: draftUpdateStoryPhotoAction.bind(null, token),
    reorderPhotos: draftReorderStoryPhotosAction.bind(null, token),
    setCoverPhoto: draftSetStoryCoverPhotoAction.bind(null, token),
    deletePhoto: draftDeleteStoryPhotoAction.bind(null, token),
    startWriting: draftStartWritingAction.bind(null, token),
    getWritingStatus: draftGetWritingStatusAction.bind(null, token),
    saveChapters: draftSaveChaptersAction.bind(null, token),
  };
}
