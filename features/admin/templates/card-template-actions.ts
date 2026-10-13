"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { externalMediaUrl } from "@/services/external-media";
import { recordCardRead } from "@/services/card-read-usage";
import { applyCardExtras } from "@/services/card-extras";
import { getEventWhatsAppContact } from "@/services/event-extras";
import { removeCardArtwork, setUploadedCardArtwork } from "@/services/card-artwork";
import { createSignedCardArtworkUpload } from "@/services/uploads";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  AI_CARD_READER_CONFIGURED,
  AiCardReaderError,
  readInvitationCard,
} from "@/lib/ai-invitation-card-reader";

/** Card reads per event for client hosts (each is a paid AI call); the platform owner is exempt. */
const CARD_TEMPLATE_READ_LIMIT = 10;

function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Reads the event's saved invitation card (its link-preview image) and
 * builds the "Matched to your card" template from it — colours and type
 * style — switching the event to it. Also picks up a WhatsApp contact
 * number printed on the card if the event doesn't have one yet.
 */
export async function buildTemplateFromCardAction(
  eventId: string,
): Promise<{ success: true; filled: string[] } | { success: false; error: string }> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  const event = await getEventById(eventId);
  if (!event) return { success: false, error: "Event not found." };
  if (!event.shareImagePath) {
    return { success: false, error: "Upload your invitation card first (Event Settings → Link preview image)." };
  }
  if (!AI_CARD_READER_CONFIGURED) return { success: false, error: "Automatic card reading isn't configured right now." };

  if (admin.role !== "owner") {
    const { count } = await supabaseAdmin()
      .from("ai_card_read_requests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) >= CARD_TEMPLATE_READ_LIMIT) {
      return { success: false, error: `You've reached the ${CARD_TEMPLATE_READ_LIMIT}-card reading limit for this event.` };
    }
  }

  const startedAt = Date.now();
  try {
    const url = await externalMediaUrl("gallery", event.shareImagePath, 600);
    const { details, usage } = await readInvitationCard(url, todayIn(event.timezone));
    const hasWhatsApp = Boolean(await getEventWhatsAppContact(eventId));
    const filled = await applyCardExtras(eventId, details, event.templateSlug, {
      switchTemplate: true,
      hasWhatsApp,
      cardPath: event.shareImagePath,
    });
    await recordCardRead({ eventId, usage, success: filled.length > 0, fieldsFilled: filled.length, durationMs: Date.now() - startedAt });
    if (!filled.some((f) => f.startsWith("Colours"))) {
      return { success: false, error: "We couldn't read the colours on this card — try a clearer image of the card itself." };
    }
    revalidatePath("/admin/templates");
    revalidatePath("/events/[slug]", "page");
    return { success: true, filled };
  } catch (err) {
    if (err instanceof AiCardReaderError && err.usage) {
      await recordCardRead({ eventId, usage: err.usage, success: false, fieldsFilled: 0, durationMs: Date.now() - startedAt });
    }
    return { success: false, error: "We couldn't read this card — please try again." };
  }
}

/**
 * Re-reads the invitation card and crops out only its illustration
 * (services/card-artwork.ts) — leaves the event's template and colours
 * alone. Also fills a WhatsApp number from the card if the event has none.
 */
export async function extractCardArtworkAction(
  eventId: string,
): Promise<{ success: true; filled: string[] } | { success: false; error: string }> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }
  const event = await getEventById(eventId);
  if (!event) return { success: false, error: "Event not found." };
  if (!event.shareImagePath) return { success: false, error: "Upload your invitation card first (it's your link preview image)." };
  if (!AI_CARD_READER_CONFIGURED) return { success: false, error: "Automatic card reading isn't configured right now." };

  if (admin.role !== "owner") {
    const { count } = await supabaseAdmin()
      .from("ai_card_read_requests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) >= CARD_TEMPLATE_READ_LIMIT) {
      return { success: false, error: `You've reached the ${CARD_TEMPLATE_READ_LIMIT}-card reading limit for this event.` };
    }
  }

  const startedAt = Date.now();
  try {
    const url = await externalMediaUrl("gallery", event.shareImagePath, 600);
    const { details, usage } = await readInvitationCard(url, todayIn(event.timezone));
    const hasWhatsApp = Boolean(await getEventWhatsAppContact(eventId));
    const filled = await applyCardExtras(eventId, details, event.templateSlug, {
      hasWhatsApp,
      cardPath: event.shareImagePath,
      applyTheme: false,
    });
    await recordCardRead({ eventId, usage, success: filled.length > 0, fieldsFilled: filled.length, durationMs: Date.now() - startedAt });
    if (!filled.includes("Card illustration")) {
      return { success: false, error: "We couldn't find an illustration on this card to use." };
    }
    revalidatePath("/admin/event-settings");
    revalidatePath("/events/[slug]", "page");
    return { success: true, filled };
  } catch (err) {
    if (err instanceof AiCardReaderError && err.usage) {
      await recordCardRead({ eventId, usage: err.usage, success: false, fieldsFilled: 0, durationMs: Date.now() - startedAt });
    }
    return { success: false, error: "We couldn't read this card — please try again." };
  }
}

/** Removes the card illustration from the event page (and storage). */
export async function removeCardArtworkAction(eventId: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
    await removeCardArtwork(eventId);
    revalidatePath("/admin/event-settings");
    revalidatePath("/events/[slug]", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove." };
  }
}

/** Step 1 of a host's own banner image upload: a signed URL into this event's card-artwork folder. */
export async function requestCardArtworkUploadAction(
  eventId: string,
  contentType: string,
  fileSize: number,
): Promise<{ success: true; path: string; signedUrl: string } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
    const { path, signedUrl } = await createSignedCardArtworkUpload({ eventId, contentType, fileSize });
    return { success: true, path, signedUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/** Step 2: makes the uploaded file the event's banner image (replacing any previous one). */
export async function confirmCardArtworkUploadAction(
  eventId: string,
  path: string,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
    const url = await setUploadedCardArtwork(eventId, path);
    revalidatePath("/admin/event-settings");
    revalidatePath("/events/[slug]", "page");
    return { success: true, url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save the image." };
  }
}
