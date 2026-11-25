import type { SafeSmtpError } from "@/lib/mailer/email-config/smtp-errors";

/**
 * Turns a Resend API error into the same short, safe shape SMTP errors get
 * (smtp-errors.ts), so the Mailer shows and stores them the same way.
 *
 * Resend's own message is only *read* to tell common cases apart; what we
 * show is always our own wording (it can name the recipient, and we never
 * echo provider text back).
 */

export interface ResendErrorLike {
  name?: string;
  message?: string;
  statusCode?: number;
}

const safe = (kind: SafeSmtpError["kind"], message: string, retryable: boolean, responseCode: number | null): SafeSmtpError => ({
  kind,
  message,
  retryable,
  responseCode,
});

/** A sending-only key can't list domains — that refusal still proves the key is real. */
export function isRestrictedKeyError(error: ResendErrorLike | null | undefined): boolean {
  if (!error) return false;
  return error.name === "restricted_api_key" || /restricted to only send emails/i.test(error.message ?? "");
}

export function sanitizeResendError(error: unknown): SafeSmtpError {
  // Resend returns plain { name, message } objects; a thrown Error means the request never got an answer.
  if (error instanceof Error) return safe("connect", "Couldn't reach Resend. Check the internet connection and try again.", true, null);
  const e = (error && typeof error === "object" ? error : {}) as ResendErrorLike;
  const name = typeof e.name === "string" ? e.name : "";
  const msg = typeof e.message === "string" ? e.message : "";
  const code = typeof e.statusCode === "number" ? e.statusCode : null;

  if (name === "rate_limit_exceeded") {
    return safe("rate_limited", "Resend's sending limit was reached. Wait a little and try again, or check your plan's limits in Resend.", true, code ?? 429);
  }
  if (name === "missing_api_key" || name === "invalid_api_Key" || /api key is invalid/i.test(msg)) {
    return safe("auth", "Resend didn't accept this API key. Copy a valid key from Resend → API Keys and replace it here.", false, code);
  }
  if (isRestrictedKeyError(e)) {
    return safe("auth", "This Resend API key isn't allowed to do that. Use a key with Sending access (or Full access).", false, code);
  }
  if (/only send testing emails|your own email address/i.test(msg)) {
    return safe(
      "recipient_rejected",
      "Resend only lets onboarding@resend.dev (or an unverified domain) send to the email address of your own Resend account. Verify your domain in Resend → Domains to email anyone else.",
      false,
      code,
    );
  }
  if (name === "invalid_from_address" || /domain is not verified|not verified/i.test(msg)) {
    return safe("sender_rejected", "Resend refused the From address — its domain must be added and verified in Resend → Domains.", false, code);
  }
  if (name === "validation_error" || name === "invalid_parameter" || name === "missing_required_field") {
    return safe("sender_rejected", "Resend refused this email. Check the From address and the recipient's address.", false, code);
  }
  if (name === "application_error" || name === "internal_server_error" || name === "concurrent_idempotent_requests" || (code !== null && code >= 500)) {
    return safe("unknown", "Resend had a temporary problem. Please try again shortly.", true, code);
  }
  if (!name) {
    // Thrown, not returned: the request never got an answer.
    return safe("connect", "Couldn't reach Resend. Check the internet connection and try again.", true, null);
  }
  return safe("unknown", "Resend couldn't send this email. Please try again.", false, code);
}
