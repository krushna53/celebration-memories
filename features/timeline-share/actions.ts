"use server";

import { revalidatePath } from "next/cache";

import { getEventBySlug } from "@/services/events";
import { getInviteeByToken } from "@/services/invitees";
import { createPublicMemoryUploader } from "@/services/public-memories";
import { areTimelineContributionsEnabled, createSubmission, type SubmissionInput } from "@/services/timeline-contributions";
import { createSignedTimelineContributionUpload, UploadValidationError } from "@/services/uploads";

/**
 * Server Actions for the guest page /events/[slug]/timeline/share. Same
 * trust model as public memory uploads (features/uploads/public-memory-actions.ts):
 * the guest's token is the credential — every action re-resolves the
 * guest and their event from it, and re-checks that the host has the
 * page switched on.
 */

async function resolveGuest(token: string) {
  const found = typeof token === "string" && token ? await getInviteeByToken(token) : null;
  if (!found) throw new Error("This link has expired — please reload the page.");
  if (!(await areTimelineContributionsEnabled(found.event.id))) throw new Error("This page isn't taking contributions right now.");
  return found;
}

export type IdentifyContributorResult = { success: true; token: string } | { success: false; error: string };

/** Public visitors (no invite link) give their name and get a guest token, like the public memories page. */
export async function identifyTimelineContributorAction(
  eventSlug: string,
  name: string,
  honeypot?: string,
): Promise<IdentifyContributorResult> {
  // A bot filled the hidden field — pretend it worked.
  if (honeypot) return { success: true, token: "" };
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return { success: false, error: "Please enter your name." };
  if (trimmed.length > 100) return { success: false, error: "That name looks too long — please shorten it." };

  const event = await getEventBySlug(eventSlug);
  if (!event || !(await areTimelineContributionsEnabled(event.id))) {
    return { success: false, error: "This page isn't taking contributions right now." };
  }
  try {
    const invitee = await createPublicMemoryUploader(event.id, trimmed);
    return { success: true, token: invitee.token };
  } catch (err) {
    console.error("identifyTimelineContributorAction failed:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function requestContributionUploadAction(token: string, fileName: string, contentType: string, fileSize: number) {
  try {
    const { event } = await resolveGuest(token);
    const upload = await createSignedTimelineContributionUpload({ eventId: event.id, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    const message = err instanceof UploadValidationError || err instanceof Error ? err.message : "Upload failed.";
    return { success: false as const, error: message };
  }
}

export async function submitTimelineContributionAction(token: string, input: SubmissionInput) {
  try {
    const { event, invitee } = await resolveGuest(token);
    await createSubmission(event.id, { id: invitee.id, name: invitee.name }, input);
    revalidatePath("/admin/timeline");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
