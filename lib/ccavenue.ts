import "server-only";
import crypto from "node:crypto";

import { getCCAvenueSettings } from "@/services/payment-settings";

/**
 * CCAvenue integration — the third checkout option alongside Stripe and
 * Razorpay (see services/billing-settings.ts). Unlike those two, there's
 * no REST API + hosted-checkout-URL flow: CCAvenue's kit requires the
 * merchant to AES-encrypt the order details and HTML-form-POST them
 * (with the Access Code) to their transaction endpoint, which is why
 * features/start/actions/payment.ts's CCAvenue branch returns form
 * fields for the browser to auto-submit instead of calling redirect()
 * like the other two providers do. See
 * app/api/webhooks/ccavenue/route.ts for the matching decrypt step on
 * the way back.
 *
 * The encrypt/decrypt algorithm below (MD5 of the Working Key as a
 * 128-bit AES key, an all-zero 16-byte IV, AES-128-CBC) matches
 * CCAvenue's own published integration-kit sample code — verify against
 * your merchant dashboard's kit if transactions ever fail to decrypt,
 * since this isn't a versioned SDK Anthropic controls.
 *
 * Credentials (Merchant ID / Access Code / Working Key) come from
 * services/payment-settings.ts, editable at Admin > Billing > API Keys.
 * Creating the CCAvenue merchant account itself has to be done by a
 * human — same as Stripe/Razorpay.
 */
const CCAVENUE_TEST_URL = "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";
const CCAVENUE_LIVE_URL = "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

function deriveKey(workingKey: string): Buffer {
  return crypto.createHash("md5").update(workingKey, "utf8").digest();
}

const ZERO_IV = Buffer.alloc(16, 0);

export function encryptCCAvenue(plainText: string, workingKey: string): string {
  const key = deriveKey(workingKey);
  const cipher = crypto.createCipheriv("aes-128-cbc", key, ZERO_IV);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decryptCCAvenue(encryptedHex: string, workingKey: string): string {
  const key = deriveKey(workingKey);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, ZERO_IV);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function isCCAvenueConfigured(): Promise<boolean> {
  const { merchantId, accessCode, workingKey } = await getCCAvenueSettings();
  return Boolean(merchantId && accessCode && workingKey);
}

export async function isCCAvenueOneTimeConfigured(): Promise<boolean> {
  const { amountOneTime } = await getCCAvenueSettings();
  return Boolean(amountOneTime);
}

export async function getCCAvenueTransactionUrl(): Promise<string> {
  const { testMode } = await getCCAvenueSettings();
  return testMode ? CCAVENUE_TEST_URL : CCAVENUE_LIVE_URL;
}

/** Turns an object of order fields into the `key=value&key=value` plain-text CCAvenue expects before encryption. Values are URI-encoded since CCAvenue's own kit does the same. */
export function buildCCAvenueRequestString(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

/** Reverses buildCCAvenueRequestString — parses CCAvenue's decrypted response body back into an object. */
export function parseCCAvenueResponseString(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of text.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    result[key] = decodeURIComponent(value);
  }
  return result;
}
