import "server-only";
import OpenAI from "openai";
import { z } from "zod";

import type { EventSegment } from "@/lib/event-segment";
import type { TimelineMilestoneSuggestion, TimelinePhotoGroupInput } from "@/types/timeline-import";

/**
 * Writes Timeline milestones (period + title + description) for groups of
 * photos the host imported in one go — one low-detail thumbnail per group
 * plus what the files themselves say about when/where they were taken.
 * Same OPENAI_API_KEY / OPENAI_TEXT_MODEL, typed-error-with-usage and
 * raw-JSON-then-zod conventions as lib/ai-rsvp-config.ts.
 *
 * All groups go in ONE call so the titles read as a story and don't
 * repeat each other. Suggestions only — the host reviews every one
 * before anything is saved (features/admin/timeline/photo-timeline-import.tsx).
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export interface TimelineWriterUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export class AiTimelineWriterError extends Error {
  constructor(
    message: string,
    readonly usage?: TimelineWriterUsage,
  ) {
    super(message);
  }
}

export interface TimelineWriterContext {
  honoreeName: string;
  eventName: string;
  category: string;
  occasion: string | null;
  segment: EventSegment;
}

const ResultSchema = z.object({
  milestones: z.array(
    z.object({
      index: z.number().int().min(1),
      period: z.string().min(1).max(40),
      title: z.string().min(1).max(80),
      description: z.string().min(1).max(400),
    }),
  ),
});

const SHARED_RULES = `Output ONLY a single raw JSON object — no markdown fences, no text before or after:
{ "milestones": [ { "index": number, "period": string, "title": string, "description": string } ] }
Return exactly one entry per photo group, using the group's number as "index".

"period":
- If the group has a period from its files, use it exactly as given.
- If the photo is clearly an old print (black-and-white, sepia, faded colours, vintage clothing) but the file date is recent, the file date is only when it was scanned or re-photographed — ignore it and give the decade instead, e.g. "1960s".
- Undated groups: estimate the decade from what you see ("1970s"); if you truly can't tell, a short life-stage label like "Early years".

"title": 2 to 6 words, title case, concrete — say what is happening and, when known and it helps, where (e.g. "Monsoon Trip to Lonavala", "Cutting the Birthday Cake", "First Day of School").

"description": one or two sentences, at most 200 characters. Describe what the photos show and weave in the place and date facts naturally. Plain, specific, human.

Rules for both:
- Never use these stock words: warm, cherished, joyful, lovely, beautiful, memories, moments, special, journey.
- NEVER invent names, relationships, religions or occasions you can't see. "Bride and groom", "a toddler", "a group of friends" are fine; "his brother Ramesh" is not. A group of N photos only tells you N photos were taken — don't claim it was "a week-long trip" unless the dates say so.
- Don't repeat the same title pattern for every group — the list should read like a life story.`;

const FAMILY_INSTRUCTIONS = `You help families build the life Timeline on a celebration website (birthdays, anniversaries, weddings). The host uploaded a batch of photos; they've been grouped by when and where they were taken. For each group you see one representative photo plus the facts from the photo files. Write one Timeline milestone per group.

${SHARED_RULES}`;

const CORPORATE_INSTRUCTIONS = `You help companies build the Timeline on a corporate event website (anniversaries of a company, conferences, annual days). The host uploaded a batch of photos; they've been grouped by when and where they were taken. For each group you see one representative photo plus the facts from the photo files. Write one Timeline milestone per group, in a professional tone — events, launches, offsites, team moments.

${SHARED_RULES}`;

function contextLine(ctx: TimelineWriterContext): string {
  return `Event: "${ctx.eventName}" (${ctx.category}${ctx.occasion ? `, ${ctx.occasion}` : ""}), honouring ${ctx.honoreeName}.`;
}

function groupLine(group: TimelinePhotoGroupInput, index: number): string {
  const facts = [
    group.period ? `period from files: ${group.period}` : "no date in the files",
    group.dateLabel ? `taken ${group.dateLabel}` : null,
    group.place ? `in ${group.place}` : "no location in the files",
    `${group.photoCount} photo${group.photoCount === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `Group ${index}: ${facts.join("; ")}.`;
}

export async function writeTimelineMilestones(
  groups: TimelinePhotoGroupInput[],
  ctx: TimelineWriterContext,
): Promise<{ suggestions: TimelineMilestoneSuggestion[]; usage: TimelineWriterUsage }> {
  const client = getClient();
  if (!client) throw new AiTimelineWriterError("AI isn't configured — add OPENAI_API_KEY to enable it.");

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
  const content: OpenAI.Responses.ResponseInputContent[] = [
    { type: "input_text", text: `${contextLine(ctx)}\nThere are ${groups.length} photo groups, oldest first.` },
  ];
  groups.forEach((group, i) => {
    content.push({ type: "input_text", text: groupLine(group, i + 1) });
    // Low detail is plenty to tell a wedding from a beach trip, and keeps a 20-group call cheap.
    content.push({ type: "input_image", image_url: group.imageDataUrl, detail: "low" });
  });

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: ctx.segment === "corporate" ? CORPORATE_INSTRUCTIONS : FAMILY_INSTRUCTIONS,
      input: [{ role: "user", content }],
      // Reasoning models spend part of this budget thinking — too tight a cap returns an empty answer.
      max_output_tokens: 6000,
    });
  } catch (err) {
    throw new AiTimelineWriterError(`Couldn't write the milestones: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const usage = { model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
  const raw = response.output_text?.trim();
  if (!raw) throw new AiTimelineWriterError("The AI didn't return any milestones.", usage);

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AiTimelineWriterError("The AI didn't return usable milestones.", usage);
  }
  const parsed = ResultSchema.safeParse(json);
  if (!parsed.success) throw new AiTimelineWriterError("The AI's milestones didn't match the expected shape.", usage);

  const byIndex = new Map(parsed.data.milestones.map((m) => [m.index, m]));
  const suggestions = groups.map((group, i) => {
    const m = byIndex.get(i + 1);
    return {
      period: m?.period.trim() || group.period || "",
      title: m?.title.trim() || "",
      description: m?.description.trim() || "",
    };
  });
  return { suggestions, usage };
}
