"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { createMilestone, deleteMilestone, updateMilestone } from "@/services/timeline";
import { createSignedTimelineImageUpload } from "@/services/uploads";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
}

function revalidateTimelinePaths() {
  revalidatePath("/admin/timeline");
  revalidatePath("/");
}

export async function createMilestoneAction(input: {
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder: number;
}) {
  try {
    await requireAdmin();
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
    await requireAdmin();
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
    await requireAdmin();
    const upload = await createSignedTimelineImageUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function confirmTimelineImageUploadAction(milestoneId: string, path: string) {
  try {
    await requireAdmin();
    await updateMilestone(milestoneId, { imagePath: path });
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeTimelineImageAction(milestoneId: string) {
  try {
    await requireAdmin();
    await updateMilestone(milestoneId, { imagePath: null });
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteMilestoneAction(id: string) {
  try {
    await requireAdmin();
    await deleteMilestone(id);
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
