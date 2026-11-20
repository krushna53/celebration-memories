/**
 * Turns whatever the SMTP library threw into a short, safe message.
 *
 * The raw error is only *read* to classify it — its text is never shown,
 * stored or logged, because SMTP servers sometimes echo the login or
 * other details back in their responses. Only our own wording, the
 * numeric SMTP reply code and the host/port the admin typed are used.
 */

export type SmtpErrorKind =
  | "auth"
  | "connect"
  | "timeout"
  | "tls"
  | "dns"
  | "blocked_host"
  | "sender_rejected"
  | "recipient_rejected"
  | "rate_limited"
  | "not_configured"
  | "unknown";

export interface SafeSmtpError {
  kind: SmtpErrorKind;
  message: string;
  responseCode: number | null;
  /** Worth retrying later (timeouts, 4xx replies) rather than a settings problem. */
  retryable: boolean;
}

/** Thrown by our own code with a message that is already safe to show. */
export class SmtpSafeError extends Error {
  constructor(
    readonly kind: SmtpErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SmtpSafeError";
  }
}

function field(err: unknown, key: string): unknown {
  return err && typeof err === "object" ? (err as Record<string, unknown>)[key] : undefined;
}

export function sanitizeSmtpError(err: unknown, ctx: { host: string; port: number }): SafeSmtpError {
  if (err instanceof SmtpSafeError) {
    return { kind: err.kind, message: err.message, responseCode: null, retryable: err.kind === "timeout" || err.kind === "connect" };
  }

  const code = String(field(err, "code") ?? "");
  const command = String(field(err, "command") ?? "").toUpperCase();
  const rc = Number(field(err, "responseCode"));
  const responseCode = Number.isFinite(rc) && rc >= 200 && rc < 600 ? rc : null;
  // Used for classification only — never copied into the result.
  const raw = String(field(err, "message") ?? "").toLowerCase();
  const where = `${ctx.host}:${ctx.port}`;
  const withCode = (text: string) => (responseCode ? `${text} (SMTP ${responseCode})` : text);
  const result = (kind: SmtpErrorKind, message: string, retryable: boolean): SafeSmtpError => ({ kind, message, responseCode, retryable });

  if (code === "EAUTH" || responseCode === 535 || responseCode === 534 || responseCode === 530) {
    return result("auth", withCode("The SMTP server rejected the username or password. Check them — Gmail and Microsoft need an app password, SendGrid an API key."), false);
  }
  if (code === "EDNS" || raw.includes("enotfound") || raw.includes("getaddrinfo")) {
    return result("dns", `Couldn't find the SMTP host "${ctx.host}". Check the spelling.`, false);
  }
  if (code === "ETIMEDOUT" || raw.includes("timeout") || raw.includes("timed out")) {
    return result("timeout", `Timed out talking to ${where}. Check the host and port, or try again later.`, true);
  }
  if (
    code === "ETLS" ||
    raw.includes("certificate") ||
    raw.includes("ssl routines") ||
    raw.includes("wrong version number") ||
    raw.includes("tls")
  ) {
    return result("tls", `The secure (TLS) connection to ${where} failed. Port 465 needs SSL/TLS and port 587 needs STARTTLS — check the encryption setting.`, false);
  }
  if (code === "ECONNECTION" || code === "ESOCKET" || raw.includes("econnrefused") || raw.includes("econnreset") || raw.includes("ehostunreach")) {
    return result("connect", `Couldn't connect to ${where}. Check the host and port; some networks block outgoing SMTP.`, true);
  }
  if (responseCode && responseCode >= 400 && responseCode < 500) {
    return result("rate_limited", withCode("The SMTP server asked us to try again later — it may be rate-limiting this account."), true);
  }
  if (code === "EENVELOPE" || (responseCode && responseCode >= 500)) {
    if (command.startsWith("MAIL")) {
      return result("sender_rejected", withCode("The SMTP server refused the From address. Make sure this account is allowed to send as that address (and the domain is verified with the provider)."), false);
    }
    if (command.startsWith("RCPT")) {
      return result("recipient_rejected", withCode("The SMTP server refused the recipient address."), false);
    }
    return result("unknown", withCode("The SMTP server refused the message."), false);
  }
  return result("unknown", `Something went wrong talking to ${where}. Check the settings and try again.`, true);
}
