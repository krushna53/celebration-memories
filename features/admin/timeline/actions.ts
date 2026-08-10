"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { createMilestone, deleteMilestone, getMilestoneById, updateMilestone } from "@/services/timeline";
import { createSignedTimelineImageUpload } from "@/services/uploads";
import { snapshotTimeline } from "@/services/event-snapshots";

function revalidateTimelinePaths() {
  revalidatePath("/admin/timeline");
  revalidatePath("/");
}

/** Looks up which event a milestone belongs to and confirms the caller is allowed to manage it — closes the gap where any logged-in admin could edit/delete another client's timeline by milestone id alone. */
async function requireAdminForMilestone(id: string) {
  const milestone = await getMilestoneById(id);
  if (!milestone) throw new Error("Milestone not found.");
  const admin = await requireAdminForEvent(milestone.eventId);
  return { admin, milestone };
}

export async function createMilestoneAction(input: {
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder: number;
}) {
  try {
    const admin = await requireAdminForEvent(input.eventId);
    await snapshotTimeline(input.eventId, admin.id).catch((err) => console.error("snapshotTimeline failed:", err));
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
    const { admin, milestone } = await requireAdminForMilestone(id);
    // Skip snapshotting a pure reorder (sortOrder-only patch) — the timeline
    // manager fires one updateMilestoneAction per row on every drag, which
    // would otherwise flood the history with near-duplicate snapshots for a
    // single user gesture. Any real content change still snapshots first.
    const isPureReorder = Object.keys(input).every((key) => key === "sortOrder");
    if (!isPureReorder) {
      await snapshotTimeline(milestone.eventId, admin.id).catch((err) => console.error("snapshotTimeline failed:", err));
    }
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
    const { admin, milestone } = await requireAdminForMilestone(milestoneId);
    await snapshotTimeline(milestone.eventId, admin.id).catch((err) => console.error("snapshotTimeline failed:", err));
    await updateMilestone(milestoneId, { imagePath: path });
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeTimelineImageAction(milestoneId: string) {
  try {
    const { admin, milestone } = await requireAdminForMilestone(milestoneId);
    await snapshotTimeline(milestone.eventId, admin.id).catch((err) => console.error("snapshotTimeline failed:", err));
    await updateMilestone(milestoneId, { imagePath: null });
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteMilestoneAction(id: string) {
  try {
    const { admin, milestone } = await requireAdminForMilestone(id);
    await snapshotTimeline(milestone.eventId, admin.id).catch((err) => console.error("snapshotTimeline failed:", err));
    await deleteMilestone(id);
    revalidateTimelinePaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
