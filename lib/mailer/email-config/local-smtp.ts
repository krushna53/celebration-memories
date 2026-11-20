/**
 * Local email testing with Mailpit (https://mailpit.axllent.org): a fake
 * SMTP server on this computer that catches every email, so campaigns can
 * be tried without reaching anybody's real inbox. Read the caught emails at
 * http://localhost:8025.
 *
 * Normally the SMTP connection refuses local addresses, plain-text (no TLS)
 * connections and non-standard ports. The "Local test (Mailpit)" provider is
 * the one exception, and only when BOTH hold:
 *   - the app runs under `npm run dev` (NODE_ENV=development), and
 *   - MAILER_ALLOW_LOCAL_SMTP=true is set in .env.local.
 * It is checked when a configuration is saved AND again every time a
 * connection is opened, so a production server can never use it.
 */

export const LOCAL_SMTP_HOSTS = ["127.0.0.1", "localhost"] as const;
export const LOCAL_SMTP_PORT = 1025;
export const MAILPIT_INBOX_URL = "http://localhost:8025";

export function localSmtpAllowed(env: { NODE_ENV?: string; MAILER_ALLOW_LOCAL_SMTP?: string } = process.env): boolean {
  return env.NODE_ENV === "development" && (env.MAILER_ALLOW_LOCAL_SMTP ?? "").trim().toLowerCase() === "true";
}

export function isLocalSmtpHost(host: string): boolean {
  return (LOCAL_SMTP_HOSTS as readonly string[]).includes(host.trim().toLowerCase());
}
