"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getEventById, updateEvent, type EventUpdateInput } from "@/services/events";
import {
  createSignedHighlightReelUpload,
  createSignedShareImageUpload,
  createSignedShareVideoUpload,
} from "@/services/uploads";
import { validateCustomCss } from "@/lib/custom-css";
import { AiCssError, generateCustomCssFromPrompt } from "@/lib/ai-css";
import { countAiCssGenerations, recordAiCssGeneration } from "@/services/ai-css-generations";
import { resolveTimezoneFromAddress } from "@/lib/timezone-lookup";
import type { SectionConfigItem } from "@/lib/section-registry";

export type AdminActionResult = { success: true } | { success: false; error: string };

export type DetectTimezoneResult = { success: true; timezone: string } | { success: false; error: string };

/**
 * Best-effort venue-address -> IANA timezone lookup (see
 * lib/timezone-lookup.ts) for the "Detect" button next to the Timezone
 * field. Doesn't require the caller to already be able to write this
 * event (unlike updateEventAction) — it's a pure lookup with no side
 * effect, the admin still has to hit Save to apply whatever it finds —
 * but does still require a valid admin session so it can't be used as
 * an open geocoding proxy by anyone who finds the endpoint.
 */
export async function detectEventTimezoneAction(eventId: string, address: string): Promise<DetectTimezoneResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

  if (!address.trim()) {
    return { success: false, error: "Enter a venue address first." };
  }

  const timezone = await resolveTimezoneFromAddress(address);
  if (!timezone) {
    return { success: false, error: "Couldn't detect a timezone for that address — please choose one manually." };
  }
  return { success: true, timezone };
}

function unauthorized(err: unknown): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
}

export async function updateEventAction(
  eventId: string,
  input: EventUpdateInput,
): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

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
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

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
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedShareImageUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeShareImageAction(eventId: string): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

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
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

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
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedShareVideoUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeShareVideoAction(eventId: string): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

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
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

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

export async function requestHighlightReelUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedHighlightReelUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Saves the just-uploaded path as the event's Big Screen Display highlight reel. */
export async function confirmHighlightReelUploadAction(
  eventId: string,
  path: string,
): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

  try {
    await updateEvent(eventId, { highlightReelPath: path });
    revalidatePath("/admin/event-settings");
    revalidatePath("/events/[slug]/display", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeHighlightReelAction(eventId: string): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

  try {
    await updateEvent(eventId, { highlightReelPath: null });
    revalidatePath("/admin/event-settings");
    revalidatePath("/events/[slug]/display", "page");
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
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return unauthorized(err);
  }

  if (!prompt.trim()) {
    return { success: false, error: "Please describe the style change you want." };
  }

  let remaining: number | null = null;

  // Looked up by the eventId the caller passed (this event, not
  // necessarily the flagship EVENT_SLUG one) — a client admin could be
  // scoped to any event created through the wizard. This used to always
  // check/describe the flagship event regardless of which event the
  // client was actually working on — same class of bug as the
  // slideshow quota fix in features/admin/slideshow/actions.ts, just
  // for AI CSS's quota *and* prompt context (honoree/tagline/category)
  // instead of a render quota.
  const event = await getEventById(eventId);

  if (admin.role === "client") {
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
