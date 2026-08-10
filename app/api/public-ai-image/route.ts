import "server-only";
import { NextResponse } from "next/server";

import { AI_IMAGE_CONFIGURED, AiImageError, generateAiImage } from "@/lib/ai-image";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { checkPublicAiImageRateLimit, recordPublicAiImageRequest } from "@/services/public-ai-image-rate-limit";

export const dynamic = "force-dynamic";

const MAX_PROMPT_LENGTH = 500;

/**
 * Backs the public, no-login "AI Invitation Image" tool (#81,
 * app/ai-invitation-image/page.tsx) — a marketing/lead-gen page that
 * lets anyone try the AI Image feature without an account before
 * committing to /start. Reachable by anyone on the internet with no
 * admin auth gate, unlike the admin AI Image feature
 * (features/admin/ai-image/actions.ts), so this route itself — not a
 * Server Action a page merely renders — is the enforcement point for
 * both the per-IP/global rate limit (services/public-ai-image-rate-
 * limit.ts) and the OpenAI call, since a determined caller could hit
 * this URL directly regardless of what the page's UI does.
 *
 * Uses the previously-unused lib/ai-image.ts helper (generateAiImage)
 * directly rather than the admin flow's Edge-Function detour — that
 * detour exists so the admin tool can use "high" quality (which
 * routinely exceeds Netlify's function time limit); this tool
 * deliberately stays at "medium" quality specifically so it fits
 * comfortably inside that limit with no Edge Function needed. No
 * Storage write either — the PNG is returned to the browser as a
 * base64 data URL and shown/downloaded client-side only, so there's
 * nothing to persist, moderate, or purge later.
 */
export async function POST(request: Request) {
  if (!AI_IMAGE_CONFIGURED) {
    return NextResponse.json({ error: "This tool isn't configured right now. Please try again later." }, { status: 503 });
  }

  let body: { prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Please describe the invitation image you want." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Please keep the description under ${MAX_PROMPT_LENGTH} characters.` }, { status: 400 });
  }

  const ipHash = hashIp(getClientIp(request));
  const rateLimit = await checkPublicAiImageRateLimit(ipHash);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 429 });
  }

  try {
    const image = await generateAiImage({ prompt, size: "1024x1024", quality: "medium" });
    // Recorded only after a successful generation — a failed/errored
    // attempt shouldn't burn part of the caller's daily allowance.
    await recordPublicAiImageRequest(ipHash);

    const dataUrl = `data:${image.contentType};base64,${image.buffer.toString("base64")}`;
    return NextResponse.json({ dataUrl });
  } catch (err) {
    const message = err instanceof AiImageError ? err.message : "Something went wrong generating the image. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
