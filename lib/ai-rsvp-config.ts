import "server-only";
import OpenAI from "openai";

import { MAX_QUESTIONS, sanitizeRsvpConfig, type RsvpConfig } from "@/lib/rsvp-config";

/**
 * "Generate with AI" for the RSVP form builder: turns a plain-language
 * description, or a photo of an existing form, into an RsvpConfig the host
 * then reviews in the builder (nothing is saved here). Same OpenAI setup
 * and conventions as lib/ai-form-generator.ts — raw-JSON instructions,
 * fence stripping, and the result always re-validated by
 * sanitizeRsvpConfig, so a confused model can't produce an invalid form.
 */
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export const AI_RSVP_GENERATOR_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiRsvpGeneratorError extends Error {
  constructor(
    message: string,
    readonly usage?: RsvpGenerationUsage,
  ) {
    super(message);
  }
}

export interface RsvpGenerationUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface RsvpEventContext {
  category: string;
  occasion: string | null;
  eventName: string;
}

const INSTRUCTIONS = `You set up RSVP forms for "EveryMoment", an event invitation platform. Given a description of what the host wants to ask (or a photo of an existing RSVP/registration form), you choose how to configure the platform's RSVP form.

The form ALWAYS asks the guest's full name and whether they're attending — you don't add those. You configure everything else.

Output ONLY a single raw JSON object — no markdown fences, no text before or after — with exactly this shape:
{
  "fields": {
    "phone":          { "visible": boolean, "required": boolean, "label": string },
    "email":          { "visible": boolean, "required": boolean, "label": string },
    "adults":         { "visible": boolean, "required": false,   "label": string },
    "children":       { "visible": boolean, "required": false,   "label": string },
    "mealPreference": { "visible": boolean, "required": false,   "label": string },
    "comments":       { "visible": boolean, "required": boolean, "label": string }
  },
  "attendanceLabels": { "coming": string, "maybe": string, "not_coming": string },
  "allowMaybe": boolean,
  "questions": [
    { "id": string, "label": string, "type": "text" | "long_text" | "choice" | "yes_no", "options": string[], "required": boolean }
  ]
}

Rules:
- Built-in fields: phone, email, adults (guest count), children, mealPreference (vegetarian/vegan/jain/gluten-free etc. dropdown), comments (free text). Use them instead of custom questions whenever they fit — never add a custom question that duplicates one. Hide the ones the host doesn't need (e.g. hide children for a corporate event unless asked).
- "label" renames a field; use "" to keep the default label. "required" only matters for phone, email and comments.
- attendanceLabels: wording for the three attendance choices, or "" to keep the defaults ("Joyfully Accepts" / "Maybe" / "Regretfully Declines"). Match the event's tone — e.g. "Attending" / "Not sure yet" / "Can't attend" for professional events. Set allowMaybe false only if the host wants a firm yes/no.
- questions: at most ${MAX_QUESTIONS}. "id" is short snake_case (e.g. "company", "tshirt_size"). Use "choice" with 2–10 "options" for a fixed set of answers, "yes_no" for yes/no, "long_text" only for genuinely open answers, otherwise "text". "options" is [] unless type is "choice".
- When given an image of a form, reproduce its questions faithfully, mapping each to a built-in field where one fits.
- Keep it short: only ask what the host needs.`;

function parse(raw: string, usage: RsvpGenerationUsage): RsvpConfig {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AiRsvpGeneratorError("The AI didn't return a usable form. Try rephrasing, or a clearer image.", usage);
  }
  return sanitizeRsvpConfig(json);
}

function contextLine(ctx: RsvpEventContext): string {
  return `Event: "${ctx.eventName}" — type: ${ctx.category}${ctx.occasion ? `, occasion: ${ctx.occasion}` : ""}.`;
}

export async function generateRsvpConfig(
  input: { prompt?: string; imageDataUrl?: string },
  ctx: RsvpEventContext,
): Promise<{ config: RsvpConfig; usage: RsvpGenerationUsage }> {
  const client = getClient();
  if (!client) throw new AiRsvpGeneratorError("AI isn't configured — add OPENAI_API_KEY to enable it.");
  const prompt = input.prompt?.trim() ?? "";
  if (!prompt && !input.imageDataUrl) throw new AiRsvpGeneratorError("Describe what you'd like to ask, or upload a form image.");

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
  const text = `${contextLine(ctx)}\n${prompt ? `What the host wants: ${prompt.slice(0, 2000)}` : "Set up the RSVP form from this image of an existing form."}`;

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: INSTRUCTIONS,
      input: input.imageDataUrl
        ? [
            {
              role: "user",
              content: [
                { type: "input_text", text },
                { type: "input_image", image_url: input.imageDataUrl, detail: "high" },
              ],
            },
          ]
        : text,
      // Reasoning models spend part of this budget thinking — too tight a cap returns an empty answer.
      max_output_tokens: 3000,
    });
  } catch (err) {
    throw new AiRsvpGeneratorError(`AI generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const usage = { model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
  const raw = response.output_text?.trim();
  if (!raw) throw new AiRsvpGeneratorError("The AI didn't return anything. Try rephrasing.", usage);
  return { config: parse(raw, usage), usage };
}
