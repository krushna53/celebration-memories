"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import {
  AI_CARD_READER_CONFIGURED,
  AiCardReaderError,
  readInvitationCard,
  type CardReadUsage,
  type InvitationCardDetails,
} from "@/lib/ai-invitation-card-reader";
import { buildMapsEmbedUrl, buildMapsSearchUrl, buildVenueQuery } from "@/lib/maps";
import { utcIsoToZonedInputValue, zonedInputValueToUtcIso } from "@/lib/timezone";
import { resolveTimezoneFromAddress } from "@/lib/timezone-lookup";
import { countUploadedAiImages } from "@/services/ai-image-jobs";
import { recordCardRead } from "@/services/card-read-usage";
import { updateEvent, type EventUpdateInput } from "@/services/events";
import { externalMediaUrl } from "@/services/external-media";

/**
 * Each read is a real OpenAI vision call, and a draft has no account to
 * bill against — same flat per-draft cap idea as DRAFT_AI_IMAGE_LIMIT in
 * ./ai-image.ts. Counted from recorded card uploads, since every read
 * follows exactly one upload.
 */
const DRAFT_CARD_READ_LIMIT = 8;

const DEFAULT_START_TIME = "11:00";
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

export type ReadInvitationCardResult =
  | { success: true; filled: string[]; readError: string | null }
  | { success: false; error: string };

/** Today's date as YYYY-MM-DD in the event's own timezone — so "no year on the card" resolves to the right next occurrence. */
function todayIn(timezone: string): string {
  return utcIsoToZonedInputValue(new Date().toISOString(), timezone).slice(0, 10);
}

/** Turns what the card showed into an EventUpdateInput, plus the human labels of what got filled (shown back to the host). */
async function toEventUpdate(
  details: InvitationCardDetails,
  current: { timezone: string; mapsUrl: string | null; mapsEmbedUrl: string | null },
): Promise<{ input: EventUpdateInput; filled: string[] }> {
  const input: EventUpdateInput = {};
  const filled: string[] = [];

  if (details.honoreeName) {
    input.honoreeName = details.honoreeName;
    filled.push("Name");
  }
  if (details.eventTitle) {
    input.eventTitle = details.eventTitle;
    filled.push("Tagline");
  }
  if (details.occasion) {
    input.occasion = details.occasion;
    filled.push("Occasion");
  }
  if (details.hostedBy) {
    input.hostedBy = details.hostedBy;
    filled.push("Hosted by");
  }
  if (details.venueName) {
    input.venueName = details.venueName;
    filled.push("Venue");
  }
  if (details.venueAddress) {
    input.venueAddress = details.venueAddress;
    filled.push("Address");
  }

  // Best effort, same free lookup as Event Settings' "Detect" button —
  // keeps the existing zone if the address can't be geocoded.
  let timezone = current.timezone;
  if (details.venueAddress) {
    const detected = await resolveTimezoneFromAddress(
      [details.venueName, details.venueAddress].filter(Boolean).join(", "),
    ).catch(() => null);
    if (detected) {
      timezone = detected;
      input.timezone = detected;
    }
  }

  const place = buildVenueQuery(details.venueName ?? "", details.venueAddress ?? "");
  if (place && !current.mapsUrl) {
    input.mapsUrl = buildMapsSearchUrl(place);
  }
  if (place && !current.mapsEmbedUrl) {
    input.mapsEmbedUrl = buildMapsEmbedUrl(place);
  }

  if (details.startDate) {
    const startAt = zonedInputValueToUtcIso(`${details.startDate}T${details.startTime ?? DEFAULT_START_TIME}`, timezone);
    let endAt = new Date(new Date(startAt).getTime() + DEFAULT_DURATION_MS).toISOString();
    let hasEndTime = false;
    if (details.endTime) {
      const candidate = zonedInputValueToUtcIso(`${details.endDate ?? details.startDate}T${details.endTime}`, timezone);
      if (new Date(candidate) > new Date(startAt)) {
        endAt = candidate;
        hasEndTime = true;
      }
    }
    input.startAt = startAt;
    input.endAt = endAt;
    // A card that only says "7 PM onwards" shows exactly that, not an invented end time.
    input.hasEndTime = hasEndTime;
    filled.push(details.startTime ? "Date & time" : "Date");
  }

  if (details.dressCode) {
    input.dressCode = details.dressCode;
    filled.push("Dress code");
  }
  if (details.parkingInfo) {
    input.parkingInfo = details.parkingInfo;
    filled.push("Parking");
  }
  if (details.notices.length > 0) {
    input.additionalNotes = details.notices.join("\n");
    filled.push("Notices");
  }
  if (details.message) {
    input.wishMessage = details.message;
    filled.push("Message");
  }

  return { input, filled };
}

/**
 * Called by the wizard's "Your Card" step right after the host's card
 * has been uploaded (draftRequestAiImageUploadUrlAction →
 * browser PUT → draftConfirmAiImageUploadAction). Sets the card as the
 * event's invitation/link-preview image, then reads its details with AI
 * and writes whatever it found onto the draft, so Event Details opens
 * pre-filled.
 *
 * The card is saved even when reading fails (no API key, unreadable
 * image, quota reached) — `readError` explains why nothing was filled,
 * and the host simply fills Event Details by hand as usual.
 */
export async function draftReadInvitationCardAction(
  token: string,
  eventId: string,
  path: string,
): Promise<ReadInvitationCardResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };
    // Only the draft's own uploaded cards — never an arbitrary path the client names.
    if (!path.startsWith(`${event.id}/ai-image-upload/`) || path.includes("..")) {
      return { success: false, error: "That file doesn't belong to this event." };
    }

    await updateEvent(event.id, { shareImagePath: path });

    if (!AI_CARD_READER_CONFIGURED) {
      return { success: true, filled: [], readError: "Automatic reading isn't available right now — please fill in the details yourself." };
    }
    if ((await countUploadedAiImages(event.id)) > DRAFT_CARD_READ_LIMIT) {
      return {
        success: true,
        filled: [],
        readError: `Your card is saved, but you've reached the ${DRAFT_CARD_READ_LIMIT}-card reading limit — please fill in the details yourself.`,
      };
    }

    let details: InvitationCardDetails;
    let usage: CardReadUsage;
    const startedAt = Date.now();
    let readMs = 0;
    try {
      const url = await externalMediaUrl("gallery", path, 600);
      ({ details, usage } = await readInvitationCard(url, todayIn(event.timezone)));
      readMs = Date.now() - startedAt;
    } catch (err) {
      console.error("draftReadInvitationCardAction read failed:", err);
      // OpenAI still bills a call whose answer we couldn't use — record it so /admin/usage shows the real spend.
      if (err instanceof AiCardReaderError && err.usage) {
        await recordCardRead({ eventId: event.id, usage: err.usage, success: false, fieldsFilled: 0, durationMs: Date.now() - startedAt });
      }
      return {
        success: true,
        filled: [],
        readError: "Your card is saved, but we couldn't read its details — please fill them in yourself.",
      };
    }

    const { input, filled } = await toEventUpdate(details, { timezone: event.timezone, mapsUrl: event.mapsUrl, mapsEmbedUrl: event.mapsEmbedUrl });
    await recordCardRead({
      eventId: event.id,
      usage,
      success: filled.length > 0,
      fieldsFilled: filled.length,
      durationMs: readMs,
    });
    if (filled.length > 0) await updateEvent(event.id, input);

    return {
      success: true,
      filled,
      readError: filled.length === 0 ? "Your card is saved, but we couldn't find event details on it — please fill them in yourself." : null,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
