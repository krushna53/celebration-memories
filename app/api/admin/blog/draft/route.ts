import OpenAI from "openai";
import { NextResponse } from "next/server";
import { requireBlogAdmin } from "@/services/blog-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireBlogAdmin();
  } catch {
    return NextResponse.json({ error: "An authorized blog editor must sign in to generate drafts." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenAI is not configured. Add OPENAI_API_KEY to the server environment." }, { status: 503 });
  let body: { topic?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter a blog topic." }, { status: 400 }); }
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length > 500) return NextResponse.json({ error: "Enter a topic under 500 characters." }, { status: 400 });

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
      max_output_tokens: 1800,
      instructions: "Write an original, useful wedding blog post draft for an Indian wedding audience. Create a title, short category, two-sentence excerpt, 3-6 concise tags, imageAlt describing a suitable editorial photo (do not generate an image), 3-5 sections with headings and 2-4 sentence bodies, and an optional short quote. Avoid invented statistics, false claims, and fabricated quotations. This is a draft for human review, not publication.",
      input: `Draft a blog article about: ${topic}`,
      text: { format: { type: "json_schema", name: "wedding_blog_draft", strict: true, schema: {
        type: "object", additionalProperties: false,
        properties: {
          title: { type: "string" }, category: { type: "string" }, excerpt: { type: "string" },
          tags: { type: "array", items: { type: "string" } }, imageAlt: { type: "string" },
          sections: { type: "array", items: { type: "object", additionalProperties: false, properties: { heading: { type: "string" }, body: { type: "string" } }, required: ["heading", "body"] } },
          quote: { type: "string" },
        },
        required: ["title", "category", "excerpt", "tags", "imageAlt", "sections", "quote"],
      } } },
    });
    const text = response.output_text;
    if (!text) throw new Error("OpenAI returned an empty draft.");
    const draft = JSON.parse(text);
    if (typeof draft.title !== "string" || typeof draft.excerpt !== "string" || !Array.isArray(draft.sections)) {
      throw new Error("The generated draft was incomplete.");
    }
    return NextResponse.json({ draft });
  } catch (error) {
    const apiError = error instanceof OpenAI.APIError ? error : null;
    console.error("Admin blog draft generation failed:", apiError ? { status: apiError.status, message: apiError.message } : error instanceof Error ? error.message : error);
    if (apiError?.status === 401) return NextResponse.json({ error: "OpenAI rejected the API key. Check OPENAI_API_KEY in the server environment, then restart the app." }, { status: 502 });
    if (apiError?.status === 429) return NextResponse.json({ error: "OpenAI could not generate a draft because the account has reached its usage limit. Check billing, credits, and rate limits." }, { status: 502 });
    if (apiError?.status === 404) return NextResponse.json({ error: "The configured OpenAI model is unavailable for this API key. Set OPENAI_TEXT_MODEL to a model enabled for your account." }, { status: 502 });
    return NextResponse.json({ error: "OpenAI could not generate this draft. Check the server logs for the API error, then try again." }, { status: 502 });
  }
}

