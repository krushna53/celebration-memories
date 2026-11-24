import "server-only";
import { Resend } from "resend";

import { SITE_NAME } from "@/lib/constants";

/**
 * Reusable email sending through Resend (resend.com).
 *
 *   const result = await sendEmail({ to, subject, html, text });
 *   if (result.success) result.id // Resend's email id
 *
 * Never throws: every outcome comes back as a result object, the same
 * shape the rest of the app uses ({ success: true, ... } or
 * { success: false, error, ... }). `retryable` tells a caller (a job
 * runner, say) whether trying again later could help.
 *
 * Delivery mode (EMAIL_DELIVERY_MODE):
 *   "live" — really send through Resend (needs RESEND_API_KEY).
 *   "test" — nothing leaves the server; a fake id like "test_…" is
 *            returned and the email is kept in `testOutbox` for checks.
 *   unset  — "live" in production builds, "test" everywhere else, so a
 *            developer never emails real people by accident. Set
 *            EMAIL_DELIVERY_MODE=live in .env.local to send for real.
 *
 * Server-only: the API key never reaches the browser.
 */

export type EmailDeliveryMode = "live" | "test";

export interface EmailTag {
  name: string;
  value: string;
}

export interface SendEmailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  subject: string;
  /** At least one of html / text is required. */
  html?: string;
  text?: string;
  /** Defaults to RESEND_FROM_EMAIL, then "EveryMoment <onboarding@resend.dev>". */
  from?: string;
  headers?: Record<string, string>;
  tags?: EmailTag[];
  /** Same key within 24 hours = Resend sends the email only once. */
  idempotencyKey?: string;
}

export type SendEmailErrorCode =
  | "invalid_input"
  | "not_configured"
  | "rate_limited"
  | "rejected"
  | "provider_error"
  | "network_error";

export type SendEmailResult =
  | { success: true; id: string; mode: EmailDeliveryMode }
  | { success: false; error: string; code: SendEmailErrorCode; retryable: boolean };

/** What sendEmail needs from the Resend SDK — swappable in tests. */
export interface ResendLikeClient {
  emails: {
    send(
      payload: Record<string, unknown>,
      options?: { idempotencyKey?: string },
    ): Promise<{ data: { id: string } | null; error: { name: string; message: string } | null }>;
  };
}

export interface SendEmailOptions {
  env?: Record<string, string | undefined>;
  client?: ResendLikeClient;
}

/** Resend's own limit per recipient field. */
export const MAX_RECIPIENTS = 50;
const TEST_OUTBOX_LIMIT = 50;

/** Emails "sent" in test mode, newest last (for tests and local checks). */
export const testOutbox: Array<{ id: string; at: string; payload: Record<string, unknown> }> = [];

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const TAG_RE = /^[A-Za-z0-9_-]{1,256}$/;

function processEnv(): Record<string, string | undefined> {
  return process.env as Record<string, string | undefined>;
}

export function emailDeliveryMode(env: Record<string, string | undefined> = processEnv()): EmailDeliveryMode {
  const set = env.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
  if (set === "live" || set === "test") return set;
  return env.NODE_ENV === "production" ? "live" : "test";
}

export function defaultFromAddress(env: Record<string, string | undefined> = processEnv()): string {
  return env.RESEND_FROM_EMAIL?.trim() || `${SITE_NAME} <onboarding@resend.dev>`;
}

/** "Name <a@b.com>" or "a@b.com" → "a@b.com", or null if it isn't an email. */
export function emailAddressOf(value: string): string | null {
  const trimmed = value.trim();
  const angled = /^(?:"?[^"<>\r\n]*"?\s*)?<([^<>\s]+)>$/.exec(trimmed);
  const address = angled ? angled[1]! : trimmed;
  return EMAIL_RE.test(address) && address.length <= 254 ? address : null;
}

/** "rahul@example.com" → "r***@example.com" — safe to put in logs. */
export function maskEmail(value: string): string {
  const address = emailAddressOf(value) ?? value;
  const at = address.lastIndexOf("@");
  if (at < 1) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

type ListCheck = { ok: true; list: string[] } | { ok: false; error: string };

function checkList(field: string, value: string | string[] | undefined, required: boolean): ListCheck {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const list: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) continue;
    const address = emailAddressOf(item);
    if (!address) return { ok: false, error: `${field}: "${maskEmail(item)}" isn't a valid email address.` };
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(item.trim());
  }
  if (required && list.length === 0) return { ok: false, error: `${field}: add at least one email address.` };
  if (list.length > MAX_RECIPIENTS) return { ok: false, error: `${field}: at most ${MAX_RECIPIENTS} addresses per email.` };
  return { ok: true, list };
}

type Prepared =
  | { ok: true; payload: Record<string, unknown>; idempotencyKey?: string; recipients: number }
  | { ok: false; error: string };

/** Validates the input and builds the Resend payload. */
export function prepareEmail(input: SendEmailInput, env: Record<string, string | undefined> = processEnv()): Prepared {
  const to = checkList("To", input.to, true);
  if (!to.ok) return to;
  const cc = checkList("CC", input.cc, false);
  if (!cc.ok) return cc;
  const bcc = checkList("BCC", input.bcc, false);
  if (!bcc.ok) return bcc;
  const replyTo = checkList("Reply-to", input.replyTo, false);
  if (!replyTo.ok) return replyTo;

  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  if (!subject) return { ok: false, error: "Add a subject." };
  if (/[\r\n]/.test(subject)) return { ok: false, error: "The subject can't contain line breaks." };
  if (subject.length > 998) return { ok: false, error: "The subject is too long." };

  const html = typeof input.html === "string" && input.html.trim() ? input.html : undefined;
  const text = typeof input.text === "string" && input.text.trim() ? input.text : undefined;
  if (!html && !text) return { ok: false, error: "Add an HTML or plain-text body." };

  const from = (input.from ?? defaultFromAddress(env)).trim();
  if (!emailAddressOf(from)) return { ok: false, error: "The From address isn't a valid email address." };

  if (input.headers) {
    for (const [name, value] of Object.entries(input.headers)) {
      if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(String(value))) {
        return { ok: false, error: `Header "${name}" isn't allowed.` };
      }
    }
  }
  if (input.tags?.some((t) => !TAG_RE.test(t.name) || !TAG_RE.test(t.value))) {
    return { ok: false, error: "Tag names and values may only use letters, numbers, _ and -." };
  }
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;
  if (idempotencyKey && idempotencyKey.length > 256) return { ok: false, error: "The idempotency key is too long." };

  const payload: Record<string, unknown> = { from, to: to.list, subject };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (cc.list.length) payload.cc = cc.list;
  if (bcc.list.length) payload.bcc = bcc.list;
  if (replyTo.list.length) payload.replyTo = replyTo.list;
  if (input.headers && Object.keys(input.headers).length) payload.headers = input.headers;
  if (input.tags?.length) payload.tags = input.tags;

  return { ok: true, payload, idempotencyKey, recipients: to.list.length + cc.list.length + bcc.list.length };
}

const RETRYABLE = new Set(["rate_limit_exceeded", "application_error", "internal_server_error", "concurrent_idempotent_requests"]);

function failureFromResend(error: { name: string; message: string }): SendEmailResult {
  const name = error.name ?? "unknown";
  const code: SendEmailErrorCode =
    name === "rate_limit_exceeded"
      ? "rate_limited"
      : name === "missing_api_key" || name === "invalid_api_Key"
        ? "not_configured"
        : RETRYABLE.has(name)
          ? "provider_error"
          : "rejected";
  return { success: false, error: error.message || name, code, retryable: RETRYABLE.has(name) };
}

let cachedClient: { key: string; client: Resend } | null = null;

function resendClient(apiKey: string): ResendLikeClient {
  if (!cachedClient || cachedClient.key !== apiKey) cachedClient = { key: apiKey, client: new Resend(apiKey) };
  return cachedClient.client as unknown as ResendLikeClient;
}

/** Sends one email. Never throws — see the file comment. */
export async function sendEmail(input: SendEmailInput, options: SendEmailOptions = {}): Promise<SendEmailResult> {
  const env = options.env ?? processEnv();
  const prepared = prepareEmail(input, env);
  if (!prepared.ok) return { success: false, error: prepared.error, code: "invalid_input", retryable: false };

  const mode = emailDeliveryMode(env);
  if (mode === "test") {
    const id = `test_${crypto.randomUUID()}`;
    testOutbox.push({ id, at: new Date().toISOString(), payload: prepared.payload });
    if (testOutbox.length > TEST_OUTBOX_LIMIT) testOutbox.splice(0, testOutbox.length - TEST_OUTBOX_LIMIT);
    console.info(`[email test mode — not sent] ${prepared.recipients} recipient(s), id=${id}`);
    return { success: true, id, mode };
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  const client = options.client ?? (apiKey ? resendClient(apiKey) : null);
  if (!client) {
    return { success: false, error: "Email isn't set up: RESEND_API_KEY is missing.", code: "not_configured", retryable: false };
  }

  try {
    const { data, error } = await client.emails.send(
      prepared.payload,
      prepared.idempotencyKey ? { idempotencyKey: prepared.idempotencyKey } : undefined,
    );
    if (error) {
      const failure = failureFromResend(error);
      if (!failure.success) console.error(`[email] Resend refused (${error.name}) for ${prepared.recipients} recipient(s)`);
      return failure;
    }
    if (!data?.id) {
      return { success: false, error: "Resend didn't return an email id.", code: "provider_error", retryable: true };
    }
    return { success: true, id: data.id, mode };
  } catch (err) {
    console.error("[email] Couldn't reach Resend:", err instanceof Error ? err.name : "unknown error");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't reach Resend.",
      code: "network_error",
      retryable: true,
    };
  }
}
