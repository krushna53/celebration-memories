"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForOrganizerArea } from "@/services/admin-auth";
import { snapshotTimeline } from "@/services/event-snapshots";
import {
  approveSubmission,
  getSubmissionEventId,
  rejectSubmission,
  setTimelineContributionsEnabled,
  type ApproveInput,
} from "@/services/timeline-contributions";

/** Admin side of guest Timeline contributions — see services/timeline-contributions.ts. */

function revalidate() {
  revalidatePath("/admin/timeline");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/");
}

async function requireAdminForSubmission(submissionId: string) {
  const eventId = await getSubmissionEventId(submissionId);
  if (!eventId) throw new Error("Contribution not found.");
  const admin = await requireAdminForOrganizerArea(eventId, "timeline");
  return { admin, eventId };
}

export async function setTimelineContributionsAction(eventId: string, enabled: boolean) {
  try {
    await requireAdminForOrganizerArea(eventId, "timeline");
    await setTimelineContributionsEnabled(eventId, enabled === true);
    revalidatePath("/admin/timeline");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function approveTimelineSubmissionAction(submissionId: string, input: ApproveInput) {
  try {
    const { admin, eventId } = await requireAdminForSubmission(submissionId);
    await snapshotTimeline(eventId, admin.id).catch((err) => console.error("snapshotTimeline failed:", err));
    await approveSubmission(eventId, submissionId, input);
    revalidate();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function rejectTimelineSubmissionAction(submissionId: string) {
  try {
    const { eventId } = await requireAdminForSubmission(submissionId);
    await rejectSubmission(eventId, submissionId);
    revalidatePath("/admin/timeline");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
