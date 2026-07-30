"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { createMilestone, deleteMilestone, getMilestoneById, updateMilestone } from "@/services/timeline";
import { createSignedTimelineImageUpload } from "@/services/uploads";

function revalidateTimelinePaths() {
  revalidatePath("/admin/timeline");
  revalidatePath("/");
}

/** Looks up which event a milestone belongs to and confirms the caller is allowed to manage it — closes the gap where any logged-in admin could edit/delete another client's timeline by milestone id alone. */
async function requireAdminForMilestone(id: string) {
  const milestone = await getMilestoneById(id);
  if (!milestone) throw new Error("Milestone not found.");
  await requireAdminForEvent(milestone.eventId);
  return milestone;
}

export async function createMilestoneAction(input: {
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder: number;
}) {
  try {
    await requireAdminForEvent(input.eventId);
    await createMilestone(input);
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateMilestoneAction(
  id: string,
  input: {
    period?: string;
    title?: string;
    description?: string;
    sortOrder?: number;
    imagePath?: string | null;
  },
) {
  try {
    await requireAdminForMilestone(id);
    await updateMilestone(id, input);
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function requestTimelineImageUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    await requireAdminForEvent(eventId);
    const upload = await createSignedTimelineImageUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function confirmTimelineImageUploadAction(milestoneId: string, path: string) {
  try {
    await requireAdminForMilestone(milestoneId);
    await updateMilestone(milestoneId, { imagePath: path });
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeTimelineImageAction(milestoneId: string) {
  try {
    await requireAdminForMilestone(milestoneId);
    await updateMilestone(milestoneId, { imagePath: null });
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteMilestoneAction(id: string) {
  try {
    await requireAdminForMilestone(id);
    await deleteMilestone(id);
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
