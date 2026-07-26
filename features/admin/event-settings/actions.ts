"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventBySlug, updateEvent, type EventUpdateInput } from "@/services/events";
import { createSignedShareImageUpload, createSignedShareVideoUpload } from "@/services/uploads";
import { validateCustomCss } from "@/lib/custom-css";
import { AiCssError, generateCustomCssFromPrompt } from "@/lib/ai-css";
import { countAiCssGenerations, recordAiCssGeneration } from "@/services/ai-css-generations";
import { EVENT_SLUG } from "@/lib/constants";
import type { SectionConfigItem } from "@/lib/section-registry";

export type AdminActionResult = { success: true } | { success: false; error: string };

export async function updateEventAction(
  eventId: string,
  input: EventUpdateInput,
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  if (input.customCss) {
    const cssError = validateCustomCss(input.customCss);
    if (cssError) return { success: false, error: cssError };
  }

  try {
    await updateEvent(eventId, input);
    revalidatePath("/admin/event-settings");
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/invite/[token]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateSectionConfigAction(
  eventId: string,
  config: SectionConfigItem[],
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { sectionConfig: config });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    revalidatePath("/events/[slug]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function requestShareImageUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false as const, error: "Not authorized." };

  try {
    const upload = await createSignedShareImageUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeShareImageAction(eventId: string): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { shareImagePath: null });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Saves the just-uploaded path as the event's link-preview image. */
export async function confirmShareImageUploadAction(
  eventId: string,
  path: string,
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { shareImagePath: path });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    revalidatePath("/invite/[token]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function requestShareVideoUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false as const, error: "Not authorized." };

  try {
    const upload = await createSignedShareVideoUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeShareVideoAction(eventId: string): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { shareVideoPath: null });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Saves the just-uploaded path as the event's link-preview video (og:video — Telegram only, see lib/event-metadata.ts). */
export async function confirmShareVideoUploadAction(
  eventId: string,
  path: string,
): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await updateEvent(eventId, { shareVideoPath: path });
    revalidatePath("/admin/event-settings");
    revalidatePath("/");
    revalidatePath("/invite/[token]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type GenerateCustomCssResult =
  | { success: true; css: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.ai_css_generation_limit, default 20; owner
 * is exempt), same shape as AI Image's quota. This only RETURNS the
 * generated CSS for the admin to review in the textarea — it does not
 * save it. Saving still goes through updateEventAction (and its own
 * validateCustomCss check) when the admin clicks "Save Changes", so
 * nothing generated here reaches the public page without an explicit
 * save.
 */
export async function generateCustomCssAction(
  eventId: string,
  prompt: string,
): Promise<GenerateCustomCssResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  if (!prompt.trim()) {
    return { success: false, error: "Please describe the style change you want." };
  }

  let remaining: number | null = null;

  if (admin.role === "client") {
    const event = await getEventBySlug(EVENT_SLUG);
    const limit = event?.aiCssGenerationLimit ?? 20;
    const used = await countAiCssGenerations(eventId);

    if (used >= limit) {
      return {
        success: false,
        error: `You've reached the AI CSS generation limit for this event (${limit}). Contact your site admin to raise it.`,
      };
    }
    remaining = limit - used - 1;
  }

  try {
    const event = await getEventBySlug(EVENT_SLUG);
    const css = await generateCustomCssFromPrompt({
      prompt: prompt.trim(),
      honoreeName: event?.honoreeName ?? "the honoree",
      eventTitle: event?.eventTitle ?? "celebration",
      category: event?.category ?? "birthday",
    });

    await recordAiCssGeneration({ eventId, adminId: admin.id, prompt: prompt.trim() });
    return { success: true, css, remaining };
  } catch (err) {
    if (err instanceof AiCssError) {
      return { success: false, error: err.message };
    }
    console.error("generateCustomCssAction failed:", err);
    return { success: false, error: "Something went wrong generating CSS. Please try again." };
  }
}
