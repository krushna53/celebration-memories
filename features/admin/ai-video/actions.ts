"use server";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { countAiVideoGenerations, createAiVideoJob } from "@/services/ai-video-jobs";

export type StartAiVideoResult =
  | { success: true; jobId: string; remaining: number | null }
  | { success: false; error: string };

export async function startAiVideoAction(eventId: string, prompt: string): Promise<StartAiVideoResult> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) return { success: false, error: "Please describe the video you want." };

  let remaining: number | null = null;
  if (admin.role === "client") {
    const event = await getEventById(eventId);
    const limit = event?.aiVideoGenerationLimit ?? 2;
    const used = await countAiVideoGenerations(eventId);
    if (used >= limit) return { success: false, error: `You've reached this event's AI video limit (${limit}).` };
    remaining = limit - used - 1;
  }

  try {
    return { success: true, jobId: await createAiVideoJob({ eventId, adminId: admin.id, prompt: cleanPrompt }), remaining };
  } catch (err) {
    console.error("startAiVideoAction failed:", err);
    return { success: false, error: "Something went wrong starting the video." };
  }
}
