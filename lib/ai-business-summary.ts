import "server-only";
import OpenAI from "openai";

/**
 * Generates the "AI Summary" listing field via OpenAI's Responses API —
 * same client/model/configured-flag convention as lib/ai-css.ts and
 * lib/ai-image.ts (OPENAI_API_KEY, OPENAI_TEXT_MODEL). A short,
 * search-friendly paragraph summarizing a vendor's own free-text
 * description — meant to read naturally on a listing page and help SEO,
 * not to replace the vendor's own words (their description stays
 * editable and displayed alongside it).
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_BUSINESS_SUMMARY_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiBusinessSummaryError extends Error {}

const SYSTEM_INSTRUCTIONS = `You write short, tasteful marketing summaries for vendor listings on "Celebration Memories," an event discovery marketplace (photographers, venues, decorators, entertainers, and similar event vendors).

Strict rules:
- Output ONLY the summary paragraph. No markdown, no headings, no quotation marks around it.
- 2-3 sentences, under 60 words total.
- Write in third person, confident but not overblown — no exclamation marks, no "the best," no superlatives that sound like spam.
- Base it only on the details given. Never invent specific facts (awards, client names, years of experience) that weren't provided.`;

export interface GenerateBusinessSummaryParams {
  displayName: string;
  categoryName: string;
  tagline?: string;
  description?: string;
  citiesServed?: string[];
}

export async function generateBusinessSummary(params: GenerateBusinessSummaryParams): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new AiBusinessSummaryError("AI Summary isn't configured — add OPENAI_API_KEY to enable it.");
  }

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
  const lines = [
    `Business name: ${params.displayName}`,
    `Category: ${params.categoryName}`,
    params.tagline ? `Tagline: ${params.tagline}` : null,
    params.description ? `Description: ${params.description}` : null,
    params.citiesServed && params.citiesServed.length > 0 ? `Cities served: ${params.citiesServed.join(", ")}` : null,
  ].filter(Boolean);

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: lines.join("\n"),
      max_output_tokens: 300,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AiBusinessSummaryError(`AI Summary generation failed: ${message}`);
  }

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new AiBusinessSummaryError("The AI didn't return a summary. Try adding more description first.");
  }
  return raw.replace(/^["']|["']$/g, "");
}
