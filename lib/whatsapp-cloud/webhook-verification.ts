import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta webhook security: the GET subscription handshake and the
 * X-Hub-Signature-256 check on every POST. Pure functions over strings
 * so the route handler stays thin and these are unit-testable.
 */

/** Constant-time string compare that doesn't leak length through an early return on the comparison itself. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    // Still burn a comparison so the timing of a wrong-length guess looks like any other miss.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 * Returns the challenge to echo back, or null (→ 403).
 */
export function verifyWebhookSubscription(params: URLSearchParams, expectedToken: string | undefined): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (!expectedToken || mode !== "subscribe" || !token || !challenge) return null;
  return safeEqual(token, expectedToken) ? challenge : null;
}

/**
 * `signatureHeader` is X-Hub-Signature-256 ("sha256=<hex>"), computed by
 * Meta as HMAC-SHA256 of the exact raw request body with the App Secret.
 * Must be given the raw body string — re-serialising parsed JSON changes
 * the bytes and fails the check.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !signatureHeader) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match?.[1]) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEqual(match[1].toLowerCase(), expected);
}
