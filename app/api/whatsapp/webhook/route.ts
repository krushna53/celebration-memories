import { NextResponse } from "next/server";

import { webhookSecrets } from "@/lib/whatsapp-cloud/config";
import { parseWebhookPayload } from "@/lib/whatsapp-cloud/webhook-handler";
import { verifyWebhookSignature, verifyWebhookSubscription } from "@/lib/whatsapp-cloud/webhook-verification";
import { ingestWhatsAppWebhook } from "@/services/whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Meta POSTs up to ~1000 notifications per batch; anything far larger isn't from Meta. */
const MAX_BODY_BYTES = 3 * 1024 * 1024;

/**
 * WhatsApp Cloud API webhook — https://everymoment.in/api/whatsapp/webhook
 * (Meta App → WhatsApp → Configuration; subscribe to the `messages` field).
 *
 * GET is Meta's one-time subscription handshake: echo hub.challenge when
 * hub.verify_token matches WHATSAPP_VERIFY_TOKEN, else 403.
 *
 * POST carries delivery statuses and inbound messages. Nothing is
 * trusted until X-Hub-Signature-256 checks out against the raw body.
 * Applying a batch is a handful of indexed row updates, so it runs
 * inline; Meta retries anything that doesn't get a 200, and each event's
 * dedupe key makes those retries harmless.
 */
export async function GET(request: Request): Promise<Response> {
  const challenge = verifyWebhookSubscription(new URL(request.url).searchParams, webhookSecrets().verifyToken);
  if (challenge === null) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request): Promise<Response> {
  const { appSecret } = webhookSecrets();
  if (!appSecret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const events = parseWebhookPayload(body);
  if (events === null) return NextResponse.json({ error: "Not a WhatsApp Business Account notification." }, { status: 400 });

  try {
    const result = await ingestWhatsAppWebhook(events);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // A 500 makes Meta redeliver; the dedupe keys stop a partial batch being applied twice.
    console.error("WhatsApp webhook processing failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
