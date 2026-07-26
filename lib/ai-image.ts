import "server-only";
import OpenAI from "openai";

/**
 * Thin wrapper around OpenAI's image generation API for the admin AI
 * Image tool (/admin/ai-image). Returns null (rather than throwing) when
 * OPENAI_API_KEY isn't set, so the feature degrades to a clear "not
 * configured" message instead of a crash — same pattern as lib/email.ts.
 *
 * Model defaults to gpt-image-2 (current as of mid-2026; gpt-image-1
 * shuts down October 23, 2026). Override with OPENAI_IMAGE_MODEL if
 * OpenAI ships a newer model later — no code change needed.
 *
 * Cost note: this is pay-per-image, not free. Roughly $0.02–$0.19 per
 * image depending on quality/size at 2026 pricing — see README for the
 * full breakdown. There's no built-in spend cap here beyond making this
 * an owner-only tool (see requireOwner() in the calling Server Action).
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export class AiImageError extends Error {}

export interface GenerateAiImageParams {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
}

export interface GeneratedAiImage {
  buffer: Buffer;
  contentType: string;
}

export async function generateAiImage({
  prompt,
  size = "1024x1024",
}: GenerateAiImageParams): Promise<GeneratedAiImage> {
  const client = getClient();
  if (!client) {
    throw new AiImageError(
      "AI image generation isn't configured — add OPENAI_API_KEY to enable it.",
    );
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

  const response = await client.images.generate({
    model,
    prompt,
    size,
    n: 1,
  });

  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw new AiImageError("OpenAI didn't return an image. Please try again.");
  }

  return {
    buffer: Buffer.from(image.b64_json, "base64"),
    contentType: "image/png",
  };
}

export const AI_IMAGE_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);
