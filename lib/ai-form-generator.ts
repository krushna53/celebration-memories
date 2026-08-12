import "server-only";
import OpenAI from "openai";
import { z } from "zod";

import { FORM_CATEGORY_LABELS, isRsvpCategory, type FormCategory } from "@/lib/form-category";

/**
 * Generates a whole form (title + description + fields) from either a
 * plain-text prompt or a photo/screenshot of an existing form, via
 * OpenAI's Responses API — same OPENAI_API_KEY and text model
 * (OPENAI_TEXT_MODEL) as lib/ai-css.ts, and the same
 * getClient()-returns-null / throw-a-typed-Error-on-use conventions as
 * lib/ai-css.ts and lib/ai-image.ts.
 *
 * No JSON-mode/structured-output SDK helper is used here (this
 * codebase has none precedented) — instead, the system instructions
 * strictly require a single raw JSON object as output, which is then
 * defensively stripped of markdown fences (same trick as ai-css.ts)
 * and validated against a zod schema. A model that ignores the
 * instructions or returns malformed JSON surfaces as a clear
 * AiFormGeneratorError rather than corrupting the builder's state.
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_FORM_GENERATOR_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiFormGeneratorError extends Error {}

const GeneratedFieldSchema = z.object({
  label: z.string().min(1).max(120),
  fieldType: z.enum(["text", "textarea", "email", "phone", "number", "date", "select", "radio", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).nullable(),
});

const GeneratedFormSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().nullable(),
  fields: z.array(GeneratedFieldSchema).min(1).max(20),
});

export type GeneratedForm = z.infer<typeof GeneratedFormSchema>;

/** Real token counts from the OpenAI response (response.usage) — the basis for the cost report on /admin/usage (lib/usage-pricing.ts's computeFormAiGenerationCostUsd), not an assumed/flat per-call estimate like AI Image's. */
export interface GenerationUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface GenerationResult {
  form: GeneratedForm;
  usage: GenerationUsage;
}

const SYSTEM_INSTRUCTIONS = `You design forms for "EveryMoment," a form-builder tool. Given either a plain-language description of a form, or a photo/screenshot of an existing paper or digital form, you produce a structured form definition.

Output ONLY a single raw JSON object — no markdown code fences, no explanation, no text before or after it. The JSON must match exactly this shape:
{
  "title": string (a short, clear form title),
  "description": string or null (one short sentence of context, or null if not needed),
  "fields": [
    {
      "label": string (the question/field label),
      "fieldType": one of "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "checkbox",
      "required": boolean,
      "options": array of strings, ONLY for fieldType "select" | "radio" | "checkbox" — otherwise null
    }
  ]
}

Rules:
- Use "email"/"phone"/"date"/"number" field types whenever a field is clearly that kind of data, not generic "text".
- Use "select" or "radio" for a single choice among a small fixed set of options, "checkbox" for multiple choices allowed, and always populate "options" for those three types.
- Use "textarea" only for genuinely open-ended, multi-line answers (comments, notes) — use "text" for short answers.
- Produce between 2 and 15 fields — enough to be useful, never redundant.
- When given an image of an existing form, transcribe its actual questions/fields as faithfully as possible rather than inventing new ones; only add a field the image doesn't have if something essential is obviously missing.`;

/** The occasion picked in the /forms/new wizard's step 1 (lib/form-category.ts), threaded into the model's input as light context — not a hard requirement, since a builder can still edit whatever comes back. "general"/null (not an RSVP) adds no hint at all, leaving the model to infer purely from the prompt/image as before this feature existed. */
function categoryContext(category?: FormCategory | null): string {
  if (!isRsvpCategory(category)) return "";
  return `This form is an RSVP for a ${FORM_CATEGORY_LABELS[category as FormCategory]} — lean on fields typical for that occasion (e.g. attendance, guest count, meal preference) unless the description says otherwise.\n\n`;
}

function parseModelOutput(raw: string): GeneratedForm {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new AiFormGeneratorError("The AI didn't return a valid form definition. Try rephrasing, or a clearer image.");
  }

  const result = GeneratedFormSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new AiFormGeneratorError("The AI's response didn't match the expected form shape. Please try again.");
  }
  return result.data;
}

export async function generateFormFromPrompt(prompt: string, category?: FormCategory | null): Promise<GenerationResult> {
  const client = getClient();
  if (!client) {
    throw new AiFormGeneratorError("AI form generation isn't configured — add OPENAI_API_KEY to enable it.");
  }
  if (!prompt.trim()) {
    throw new AiFormGeneratorError("Please describe the form you want.");
  }

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: `${categoryContext(category)}Describe the form to build: ${prompt.trim()}`,
      max_output_tokens: 2000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AiFormGeneratorError(`Form generation failed: ${message}`);
  }

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new AiFormGeneratorError("The AI didn't return anything. Try rephrasing your description.");
  }
  return {
    form: parseModelOutput(raw),
    usage: { model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
  };
}

/** `imageDataUrl` is a full data URL (e.g. "data:image/png;base64,...") — the caller (features/forms/builder-actions.ts) builds this client-side before the file ever leaves the browser as anything but base64 text, so no image is ever written to Storage just to be analyzed once. */
export async function generateFormFromImage(imageDataUrl: string, category?: FormCategory | null): Promise<GenerationResult> {
  const client = getClient();
  if (!client) {
    throw new AiFormGeneratorError("AI form generation isn't configured — add OPENAI_API_KEY to enable it.");
  }

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${categoryContext(category)}Extract a form definition from this image of a form.` },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      max_output_tokens: 2000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AiFormGeneratorError(`Couldn't read that image: ${message}`);
  }

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new AiFormGeneratorError("The AI couldn't make out a form in that image. Try a clearer photo.");
  }
  return {
    form: parseModelOutput(raw),
    usage: { model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
  };
}
