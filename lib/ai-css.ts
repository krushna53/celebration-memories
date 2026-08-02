import "server-only";
import OpenAI from "openai";

import { validateCustomCss } from "@/lib/custom-css";

/**
 * Generates Custom CSS from a plain-text description via OpenAI's
 * Responses API — the same OPENAI_API_KEY already used by AI Image
 * (lib/ai-image.ts), just a text model instead of an image model.
 *
 * Unlike AI Image, this does NOT need a Netlify Background Function:
 * text generation for a short CSS snippet typically finishes in a
 * couple of seconds, comfortably inside Netlify's synchronous function
 * limit (10s on the free plan) — nowhere near the 30-60s+ that made
 * OpenAI's image API need the background-job treatment.
 *
 * Every output is run through validateCustomCss() (lib/custom-css.ts)
 * before being handed back — the same blocklist hand-written Custom CSS
 * goes through — so "no JS, no url(), no @import" holds no matter what
 * the model produces. If generated CSS fails that check, this throws
 * rather than silently stripping, so the admin can just try rephrasing.
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_CSS_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiCssError extends Error {}

export interface GenerateCustomCssParams {
  prompt: string;
  honoreeName: string;
  eventTitle: string;
  category: string;
}

const SYSTEM_INSTRUCTIONS = `You write CSS for a single event's page on "EveryMoment," a hosted digital invitation platform. A host will describe a style change in plain language; you output CSS that achieves it.

Strict rules — output that breaks these will be rejected automatically:
- Output ONLY raw CSS. No markdown code fences (no \`\`\`), no explanation, no HTML, no <style> tags — just the CSS rules themselves.
- Never use url(...), @import, expression(...), javascript:, or vbscript: in any form — these are always stripped/rejected.
- Only target selectors that plausibly exist on an elegant invitation page: general elements (body, h1, h2, h3, p, a, button), and common class names like .hero, .hero-title, .countdown, .rsvp-form, .gallery, .timeline, .section-heading. Do not invent specific ids.
- Keep the result tasteful, minimal, and consistent with a luxury/elegant aesthetic (gold, ivory, navy tones) unless the description says otherwise.
- Keep it concise — a handful of focused rules, not an entire stylesheet rewrite.`;

export async function generateCustomCssFromPrompt({
  prompt,
  honoreeName,
  eventTitle,
  category,
}: GenerateCustomCssParams): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new AiCssError("AI CSS generation isn't configured — add OPENAI_API_KEY to enable it.");
  }

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: `Event: ${honoreeName}'s ${eventTitle} (a ${category} celebration).\n\nRequested style change: ${prompt}`,
      max_output_tokens: 1000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AiCssError(`AI CSS generation failed: ${message}`);
  }

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new AiCssError("The AI didn't return any CSS. Try rephrasing your description.");
  }

  // Some models add a markdown code fence despite instructions not to — strip it defensively.
  const cleaned = raw
    .replace(/^```(?:css)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const validationError = validateCustomCss(cleaned);
  if (validationError) {
    throw new AiCssError(
      `The AI generated CSS that didn't pass the safety check (${validationError}). Try rephrasing your description.`,
    );
  }

  return cleaned;
}
