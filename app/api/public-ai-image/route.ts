import "server-only";
import { NextResponse } from "next/server";

import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { checkPublicAiImageRateLimit, createPublicAiImageTicket } from "@/services/public-ai-image-rate-limit";

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
 * This route only validates, rate-limits, and issues a single-use
 * ticket — the OpenAI call itself runs in the
 * generate-public-ai-image Supabase Edge Function, which the browser
 * calls next with that ticket. Generating here directly (the original
 * design) never worked in production: image generation takes 20-60s,
 * past Netlify's synchronous function limit, so every request was cut
 * off and the browser got a non-JSON timeout page. See migration
 * 0061_public_ai_image_tickets.sql.
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

  const ipHash = hashIp(getClientIp(request.headers));
  const rateLimit = await checkPublicAiImageRateLimit(ipHash);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 429 });
  }

  const ticketId = await createPublicAiImageTicket(ipHash, prompt);
  if (!ticketId) {
    return NextResponse.json({ error: "Something went wrong. Please try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({ ticketId });
}
