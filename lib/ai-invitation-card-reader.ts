import "server-only";
import OpenAI from "openai";
import { z } from "zod";

/**
 * Reads the event details printed on an invitation card the host
 * already has — used by the wizard's "Your Card" step
 * (features/start/card-upload-step.tsx) to pre-fill Event Details
 * before the host ever sees that form. Same OPENAI_API_KEY /
 * OPENAI_TEXT_MODEL, null-client, typed-error and raw-JSON-then-zod
 * conventions as lib/ai-gallery-tagger.ts.
 *
 * Suggestions only, in the sense that matters: every value lands in the
 * normal Event Details form for the host to review and edit before
 * continuing. Anything the card doesn't clearly show comes back null and
 * the draft's existing value is kept.
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_CARD_READER_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiCardReaderError extends Error {}

const optionalText = (max: number) =>
  z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    });

const optionalPattern = (pattern: RegExp) =>
  z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && pattern.test(v.trim()) ? v.trim() : null));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const CardDetailsSchema = z.object({
  honoreeName: optionalText(120),
  eventTitle: optionalText(120),
  occasion: optionalText(80),
  hostedBy: optionalText(160),
  startDate: optionalPattern(DATE),
  startTime: optionalPattern(TIME),
  endDate: optionalPattern(DATE),
  endTime: optionalPattern(TIME),
  venueName: optionalText(160),
  venueAddress: optionalText(300),
  dressCode: optionalText(120),
  parkingInfo: optionalText(200),
  notices: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 6)),
  message: optionalText(600),
});

export type InvitationCardDetails = z.infer<typeof CardDetailsSchema>;

function buildInstructions(today: string): string {
  return `You read event invitation cards (birthdays, weddings, anniversaries, baby showers, retirements, reunions, corporate events, etc.) and extract the details printed on them so a website can be pre-filled.

Output ONLY a single raw JSON object — no markdown fences, no text before or after — with exactly these keys:
{
  "honoreeName": string | null,   // who the event is for, e.g. "Mahesh J. Shah", or "Priya & Rahul" for a wedding
  "eventTitle": string | null,    // a short tagline/headline from the card, e.g. "75 Years of Love", "Together Forever"
  "occasion": string | null,      // e.g. "75th Birthday", "Wedding Reception", "Silver Jubilee Anniversary"
  "hostedBy": string | null,      // who is inviting, e.g. "Jagruti Shah", "The Shah Family"
  "startDate": "YYYY-MM-DD" | null,
  "startTime": "HH:mm" | null,    // 24-hour clock
  "endDate": "YYYY-MM-DD" | null,
  "endTime": "HH:mm" | null,
  "venueName": string | null,     // e.g. "The Grand Ballroom, Taj Lands End"
  "venueAddress": string | null,  // street / area / city as printed, single line
  "dressCode": string | null,
  "parkingInfo": string | null,
  "notices": string[],            // short practical notes, e.g. "No gifts please", "Lunch will be served"
  "message": string | null        // the card's main invitation wording or verse, lightly cleaned up
}

Rules:
- Only use what is actually printed on the card. If something isn't shown, use null (or [] for notices). Never invent a venue, name, time or address.
- Today's date is ${today}. If the card shows a day and month but no year, use the next occurrence on or after today.
- Convert times like "11 AM", "7:30 pm", "Evening 7 onwards" to 24-hour "HH:mm". If only a start time is shown, leave endTime null. If the event ends on the same day, endDate may be null.
- If the card is in another language (e.g. Hindi, Gujarati, Marathi), translate names of places and wording into English, but keep people's names as written (transliterated to English letters).
- Keep RSVP phone numbers and contact details OUT of every field.
- If the image is not an invitation card at all, return every field as null and notices as [].`;
}

function parse(raw: string): InvitationCardDetails {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AiCardReaderError("We couldn't read the details on this card.");
  }
  const result = CardDetailsSchema.safeParse(json);
  if (!result.success) throw new AiCardReaderError("We couldn't read the details on this card.");
  return result.data;
}

/** `imageUrl` must be reachable by OpenAI — a signed Storage URL (services/external-media.ts), not a relative /media link. */
export async function readInvitationCard(imageUrl: string, today: string): Promise<InvitationCardDetails> {
  const client = getClient();
  if (!client) throw new AiCardReaderError("Reading cards isn't configured — add OPENAI_API_KEY to enable it.");

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: buildInstructions(today),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extract the event details from this invitation card." },
            // High detail — small print (addresses, times) is exactly what we need to read.
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      // Reasoning models spend part of this budget thinking — too tight a cap returns an empty answer.
      max_output_tokens: 3000,
    });
  } catch (err) {
    throw new AiCardReaderError(`Couldn't read this card: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const raw = response.output_text?.trim();
  if (!raw) throw new AiCardReaderError("We couldn't read the details on this card.");
  return parse(raw);
}
