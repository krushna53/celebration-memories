"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { saveRsvpConfig } from "@/services/rsvp-config";
import { generateRsvpConfigForEvent } from "@/services/rsvp-ai";
import { getEventById } from "@/services/events";
import type { RsvpConfig } from "@/lib/rsvp-config";

export type SaveRsvpConfigResult = { success: true; config: RsvpConfig } | { success: false; error: string };

/** Saves an event's RSVP form setup (sanitised server-side — lib/rsvp-config.ts). */
export async function saveRsvpConfigAction(eventId: string, config: unknown): Promise<SaveRsvpConfigResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }
  try {
    const saved = await saveRsvpConfig(eventId, config);
    revalidatePath("/admin/rsvp-form");
    revalidatePath("/invite/[token]", "page");
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/events/[slug]/rsvp", "page");
    return { success: true, config: saved };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

export type GenerateRsvpConfigResult = { success: true; config: RsvpConfig } | { success: false; error: string };

/** "Generate with AI" — returns a suggested config for the builder to show; the host still reviews and saves it. */
export async function generateRsvpConfigAction(
  eventId: string,
  input: { prompt?: string; imageDataUrl?: string },
): Promise<GenerateRsvpConfigResult> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }
  const event = await getEventById(eventId);
  if (!event) return { success: false, error: "Event not found." };
  try {
    const config = await generateRsvpConfigForEvent(event, input, { adminId: admin.id, exempt: admin.role === "owner" });
    return { success: true, config };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "AI generation failed." };
  }
}
