import "server-only";
import OpenAI from "openai";
import { z } from "zod";

import type { GalleryCategory } from "@/features/gallery/gallery-data";

/**
 * Suggests a gallery category + a short caption for one photo, via
 * OpenAI's Responses API with image input — same OPENAI_API_KEY /
 * OPENAI_TEXT_MODEL, null-client and typed-error conventions, and
 * raw-JSON-then-zod parsing as lib/ai-form-generator.ts.
 *
 * Suggestions only: nothing here writes to the database. The admin
 * reviews every suggestion in the gallery manager before applying it
 * (features/admin/gallery/ai-tagger.tsx).
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_GALLERY_TAGGER_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiGalleryTaggerError extends Error {}

const CATEGORIES = ["childhood", "wedding", "family", "friends", "travel", "grandchildren"] as const satisfies readonly GalleryCategory[];

const SuggestionSchema = z.object({
  category: z.enum(CATEGORIES),
  caption: z.string().min(1).max(80),
});

export type GalleryTagSuggestion = z.infer<typeof SuggestionSchema>;

const INSTRUCTIONS = `You help families organise a photo gallery for a celebration website (birthdays, anniversaries, weddings, reunions). Look at one photo and suggest where it belongs and a short caption.

Output ONLY a single raw JSON object — no markdown fences, no text before or after:
{ "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(" | ")}, "caption": string }

Category guide — prefer the most specific category that fits; use "family" only when none of the others do:
- "childhood": a child or children are the main subject of an older/vintage photo (someone growing up).
- "wedding": a wedding, engagement, bride/groom, or a couple dressed for their wedding, old or new.
- "grandchildren": babies or young children with grandparents, or young kids as the focus of a recent photo.
- "travel": away from home — trips, landmarks, scenery, beaches, lakes, city skylines, parks on holiday.
- "friends": groups of friends or colleagues rather than family.
- "family": family gatherings, functions, portraits and celebrations at home or a venue.

Caption rules:
- 3 to 8 words, sentence case, no quotes, no emoji, no hashtags.
- Be concrete: name what is actually visible — the setting, activity, objects, clothing or occasion (e.g. "Cutting the birthday cake together", "Garlanded couple at the mandap", "Posing by the lake in winter coats", "Three generations on the sofa").
- Never use these stock words: warm, cherished, joyful, lovely, beautiful, memories, moments, special. Never write a caption that could fit any family photo.
- Describe the moment, not identities. NEVER guess anyone's name, religion, caste or relationship beyond what is obvious (e.g. "bride and groom", "grandfather with toddler" are fine).
- Black-and-white, sepia or faded prints: add an approximate decade at the end when you can reasonably judge it, e.g. "Brothers in matching shirts, 1960s".
- If the photo shows a printed photo lying on a table (a photo of a photo), caption the printed photo itself.`;

function promptWithContext({ taken, place }: GalleryPhotoContext): string {
  const facts = [taken ? `taken ${taken}` : null, place ? `in ${place}` : null].filter(Boolean).join(", ");
  if (!facts) return "Suggest a category and caption for this photo.";
  return `Suggest a category and caption for this photo. The photo file says it was ${facts} — this is reliable, so you may end the caption with the place and/or year when it fits naturally (e.g. "Sunset walk on the beach, Goa 2019"), still within the word limit. A place outside the family's home region suggests "travel".`;
}

function parse(raw: string): GalleryTagSuggestion {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AiGalleryTaggerError("The AI didn't return a usable suggestion for this photo.");
  }
  const result = SuggestionSchema.safeParse(json);
  if (!result.success) throw new AiGalleryTaggerError("The AI's suggestion didn't match the expected shape.");
  return result.data;
}

/** What the photo file itself says about when/where it was taken (lib/photo-metadata.ts) — facts the model can't see in the pixels. */
export interface GalleryPhotoContext {
  /** e.g. "March 1998". */
  taken?: string | null;
  /** e.g. "Lonavala, Maharashtra". */
  place?: string | null;
}

/** `imageUrl` is the photo's public Storage URL — low detail is plenty to tell a wedding from a trip, and keeps each call cheap. */
export async function suggestGalleryTags(imageUrl: string, context: GalleryPhotoContext = {}): Promise<GalleryTagSuggestion> {
  const client = getClient();
  if (!client) throw new AiGalleryTaggerError("AI suggestions aren't configured — add OPENAI_API_KEY to enable them.");

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: promptWithContext(context) },
            { type: "input_image", image_url: imageUrl, detail: "low" },
          ],
        },
      ],
      // Reasoning models spend part of this budget thinking — too tight a cap returns an empty answer.
      max_output_tokens: 1200,
    });
  } catch (err) {
    throw new AiGalleryTaggerError(`Couldn't analyse this photo: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const raw = response.output_text?.trim();
  if (!raw) throw new AiGalleryTaggerError("The AI didn't return a suggestion for this photo.");
  return parse(raw);
}

const BoundsSchema = z.object({
  isPrint: z.boolean(),
  box: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0.05).max(1),
    height: z.number().min(0.05).max(1),
  }),
});

export type PrintBounds = z.infer<typeof BoundsSchema>;

const BOUNDS_INSTRUCTIONS = `You help clean up scanned or photographed family prints. Given one image, decide whether it is a photo OF a printed photograph (a print lying on a table/album page, with background, table edges or other prints visible around it), and if so where the main printed photograph is.

Output ONLY a single raw JSON object — no markdown, no other text:
{ "isPrint": boolean, "box": { "x": number, "y": number, "width": number, "height": number } }

- Coordinates are fractions of the full image (0 to 1): x/y is the top-left corner of the printed photograph's picture area, width/height its size.
- Hug the printed picture tightly — exclude the table, album page, background and any white print border.
- If several prints are visible, choose the largest / most central one.
- If it is NOT a photo of a print (a normal digital photo), return isPrint false and a box of {"x":0,"y":0,"width":1,"height":1}.`;

/** Where the printed photograph sits inside a photo-of-a-photo — a starting crop the admin can adjust before saving. */
export async function detectPrintBounds(imageUrl: string): Promise<PrintBounds> {
  const client = getClient();
  if (!client) throw new AiGalleryTaggerError("AI suggestions aren't configured — add OPENAI_API_KEY to enable them.");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: BOUNDS_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Find the printed photograph in this image." },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      max_output_tokens: 1200,
    });
  } catch (err) {
    throw new AiGalleryTaggerError(`Couldn't analyse this photo: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
  const raw = response.output_text?.trim();
  if (!raw) throw new AiGalleryTaggerError("The AI didn't return a crop for this photo.");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AiGalleryTaggerError("The AI didn't return a usable crop.");
  }
  const result = BoundsSchema.safeParse(json);
  if (!result.success) throw new AiGalleryTaggerError("The AI's crop didn't match the expected shape.");
  const { x, y, width, height } = result.data.box;
  // Keep the box inside the image even if the model overshoots an edge.
  const cx = Math.min(x, 0.95), cy = Math.min(y, 0.95);
  return { isPrint: result.data.isPrint, box: { x: cx, y: cy, width: Math.min(width, 1 - cx), height: Math.min(height, 1 - cy) } };
}
