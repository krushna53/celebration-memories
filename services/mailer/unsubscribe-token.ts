import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Signed unsubscribe links for live campaign emails. The token names the
 * company (tenant) and the contact, signed with a key derived from
 * MAILER_CREDENTIAL_ENCRYPTION_KEY — so a link can't be edited to
 * unsubscribe somebody else, and no database lookup is needed to trust it.
 *
 * Format: base64url("tenantId:contactId") + "." + base64url(HMAC-SHA256)
 */

const MIN_SECRET_LENGTH = 32;

function signingKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const secret = env.MAILER_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return Buffer.from(hkdfSync("sha256", secret, "everymoment-mailer", "unsubscribe-link-v1", 32));
}

function sign(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createUnsubscribeToken(tenantId: string, contactId: string, env?: NodeJS.ProcessEnv): string | null {
  const key = signingKey(env);
  if (!key) return null;
  const payload = Buffer.from(`${tenantId}:${contactId}`, "utf8").toString("base64url");
  return `${payload}.${sign(key, payload)}`;
}

export function verifyUnsubscribeToken(token: unknown, env?: NodeJS.ProcessEnv): { tenantId: string; contactId: string } | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const key = signingKey(env);
  if (!key) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(key, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [tenantId, contactId, rest] = Buffer.from(payload, "base64url").toString("utf8").split(":");
  if (!tenantId || !contactId || rest !== undefined) return null;
  return { tenantId, contactId };
}
