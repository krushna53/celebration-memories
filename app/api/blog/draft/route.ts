import OpenAI from "openai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// A small in-memory safeguard for the public prototype. The prompt and
// response are not stored; only the configured text API receives them.
const requests = new Map<string, number[]>();
const MAX_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;
const DRAFT_INSTRUCTIONS = "You are a thoughtful wedding and celebration blog writer. Write a useful, warm, original first draft in clear English. Avoid invented statistics, claims, or quotations. Return a concise title on the first line prefixed with 'Title: ', then a blank line, then a 450-650 word article with a short introduction, 3-4 descriptive section headings, and a gentle closing. This is an unpublished draft.";

async function generateWithGemini(apiKey: string, topic: string) {
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: DRAFT_INSTRUCTIONS }] },
      contents: [{ role: "user", parts: [{ text: `Create a wedding blog draft about: ${topic}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1100 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) throw new Error("Gemini's free-tier limit has been reached for now. Please try again later.");
    throw new Error(payload?.error?.message || "Gemini could not create a draft right now.");
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini did not return a draft.");
  return text as string;
}

async function generateWithOpenAI(apiKey: string, topic: string) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna",
    temperature: 0.7,
    max_tokens: 1100,
    messages: [
      { role: "system", content: DRAFT_INSTRUCTIONS },
      { role: "user", content: `Create a wedding blog draft about: ${topic}` },
    ],
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

export async function POST(request: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!geminiApiKey && !openAiApiKey) {
    return NextResponse.json({ error: "AI drafts are not connected yet. Add GEMINI_API_KEY for Gemini's free tier, or configure OPENAI_API_KEY." }, { status: 503 });
  }

  let body: { topic?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please enter a blog topic." }, { status: 400 }); }
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ error: "Please enter a blog topic." }, { status: 400 });
  if (topic.length > 300) return NextResponse.json({ error: "Keep your topic under 300 characters." }, { status: 400 });

  const ip = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter((time) => now - time < HOUR_MS);
  if (recent.length >= MAX_PER_HOUR) return NextResponse.json({ error: "This preview allows up to 3 drafts per hour. Please try again later." }, { status: 429 });
  recent.push(now);
  requests.set(ip, recent);

  try {
    // Prefer Gemini, which has a free API tier suitable for this optional test.
    const text = geminiApiKey
      ? await generateWithGemini(geminiApiKey, topic)
      : await generateWithOpenAI(openAiApiKey!, topic);
    if (!text) throw new Error("The AI did not return a draft.");
    const match = text.match(/^Title:\s*(.+?)(?:\r?\n|$)/i);
    const title = match?.[1]?.trim() || "Your blog draft";
    const draft = match ? text.slice(match[0].length).trim() : text;
    return NextResponse.json({ title, draft });
  } catch (error) {
    console.error("Blog draft generation failed:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message.startsWith("Gemini's free-tier limit")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Draft generation failed. Please try again in a moment." }, { status: 502 });
  }
}

