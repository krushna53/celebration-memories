import "server-only";

import { countRows } from "@/services/admin-stats";

export interface SetupProgressCounts {
  galleryPhotoCount: number;
  timelineMilestoneCount: number;
  /** Guest photos/videos/audio/messages that are actually live on the Memory Wall, not just submitted and still awaiting approval. */
  approvedMemoryCount: number;
}

/**
 * Lightweight existence counts used purely to decide whether each card
 * on /admin/simple's "What would you like to do?" checklist should show
 * as done — separate from services/admin-stats.ts's DashboardStats,
 * which counts *all* guest uploads (approved or not) for the stat cards
 * at the top of the page, a different question than "has this section
 * actually been set up yet."
 */
export async function getSetupProgressCounts(eventId: string): Promise<SetupProgressCounts> {
  const [galleryPhotoCount, timelineMilestoneCount, approvedPhotos, approvedVideos, approvedAudio, approvedMessages] =
    await Promise.all([
      countRows("gallery_photos", eventId),
      countRows("timeline_milestones", eventId),
      countRows("photos", eventId, { approved: true }),
      countRows("videos", eventId, { approved: true }),
      countRows("audio", eventId, { approved: true }),
      countRows("guestbook", eventId, { approved: true }),
    ]);

  return {
    galleryPhotoCount,
    timelineMilestoneCount,
    approvedMemoryCount: approvedPhotos + approvedVideos + approvedAudio + approvedMessages,
  };
}
