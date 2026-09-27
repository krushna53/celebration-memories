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

Category guide:
- "childhood": the photo's main subject is a child or children in an older/vintage photo (a family member growing up).
- "wedding": a wedding, engagement or bride/groom photo, old or new.
- "grandchildren": small children with grandparents, or young kids in a recent photo.
- "travel": trips, landmarks, scenery, holidays.
- "friends": groups of friends or colleagues rather than family.
- "family": everything else — family gatherings, functions, portraits, celebrations.

Caption rules:
- Warm and short: 3 to 8 words, sentence case, no quotes, no emoji, no hashtags.
- Describe the moment, not the people's identities. NEVER guess anyone's name, religion, caste or relationship beyond what is obvious (e.g. "bride and groom" is fine).
- If the photo is clearly old (black-and-white, faded print, scanned photo), you may add an approximate decade at the end, e.g. "Family portrait, 1970s". Only add a decade when you are reasonably confident; otherwise leave it out.
- If the photo shows a printed photo lying on a table (a photo of a photo), caption the printed photo itself.`;

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

/** `imageUrl` is the photo's public Storage URL — low detail is plenty to tell a wedding from a trip, and keeps each call cheap. */
export async function suggestGalleryTags(imageUrl: string): Promise<GalleryTagSuggestion> {
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
            { type: "input_text", text: "Suggest a category and caption for this photo." },
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
