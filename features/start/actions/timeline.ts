"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { createMilestone, deleteMilestone, getMilestoneById, updateMilestone } from "@/services/timeline";
import { createSignedTimelineImageUpload } from "@/services/uploads";

/** Draft-token-gated mirrors of features/admin/timeline/actions.ts — see that file and draft-auth.ts. */

async function ownedMilestone(token: string, milestoneId: string) {
  const event = await requireDraftEvent(token);
  const milestone = await getMilestoneById(milestoneId);
  if (!milestone || milestone.eventId !== event.id) throw new Error("Not found.");
  return { event, milestone };
}

export async function draftCreateMilestoneAction(
  token: string,
  input: { eventId: string; period: string; title: string; description: string; sortOrder: number },
) {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== input.eventId) return { success: false as const, error: "This link doesn't match that event." };
    await createMilestone(input);
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftUpdateMilestoneAction(
  token: string,
  id: string,
  input: { period?: string; title?: string; description?: string; sortOrder?: number; imagePath?: string | null },
) {
  try {
    await ownedMilestone(token, id);
    await updateMilestone(id, input);
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftRequestTimelineImageUploadUrlAction(
  token: string,
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false as const, error: "This link doesn't match that event." };
    const upload = await createSignedTimelineImageUpload({ eventId: event.id, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftConfirmTimelineImageUploadAction(token: string, milestoneId: string, path: string) {
  try {
    await ownedMilestone(token, milestoneId);
    await updateMilestone(milestoneId, { imagePath: path });
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftRemoveTimelineImageAction(token: string, milestoneId: string) {
  try {
    await ownedMilestone(token, milestoneId);
    await updateMilestone(milestoneId, { imagePath: null });
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftDeleteMilestoneAction(token: string, id: string) {
  try {
    await ownedMilestone(token, id);
    await deleteMilestone(id);
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
