import type { EmailConfigState, EmailConfigView } from "@/types/mailer-email-config";
import type { CleanEmailConfig } from "@/lib/mailer/email-config/validation";

/**
 * What state a configuration is in, and whether campaigns may use it.
 *
 * "Verified" is earned, never assumed: saving only stores settings; a
 * connection test proves the server accepts the login; a test email the
 * server accepts proves the sender identity works; and only DNS lookups
 * (not SMTP success) can say SPF/DKIM/DMARC are in place.
 */

type StateInput = Pick<
  EmailConfigView,
  "authEnabled" | "smtpUsername" | "hasPassword" | "connectionStatus" | "verifiedAt" | "domainCheck"
>;

export function emailConfigState(c: StateInput): EmailConfigState {
  if (c.authEnabled && (!c.smtpUsername || !c.hasPassword)) return "incomplete";
  if (c.connectionStatus === "failed") return "connection_failed";
  if (c.connectionStatus === "untested") return "untested";
  if (!c.verifiedAt) return "connection_ok";
  return c.domainCheck?.overall === "verified" ? "verified" : "domain_pending";
}

export const EMAIL_CONFIG_STATE_LABELS: Record<EmailConfigState, { label: string; help: string }> = {
  incomplete: { label: "Configuration incomplete", help: "Add the SMTP username and password, then save." },
  untested: { label: "Not tested yet", help: "Run Test SMTP Connection to check these settings." },
  connection_failed: { label: "Connection failed", help: "Fix the settings below and test again." },
  connection_ok: { label: "Connection successful", help: "Send a test email to finish verifying this sender." },
  domain_pending: { label: "Domain authentication pending", help: "Sending works. Check SPF, DKIM and DMARC so mail doesn't land in spam." },
  verified: { label: "Configuration verified", help: "Sending works and the domain's SPF, DKIM and DMARC records are in place." },
};

type SendInput = StateInput & Pick<EmailConfigView, "sendingEnabled">;

/** Whether a campaign may be delivered through this configuration (domain records are advised, not required). */
export function canSendWith(c: SendInput): { ok: true } | { ok: false; reason: string } {
  const state = emailConfigState(c);
  if (state === "incomplete") return { ok: false, reason: "This email configuration is incomplete." };
  if (!c.sendingEnabled) return { ok: false, reason: "Sending is turned off for this email configuration." };
  if (state !== "domain_pending" && state !== "verified") {
    return { ok: false, reason: "This email configuration isn't verified yet — test the connection and send a test email first." };
  }
  return { ok: true };
}

type Comparable = Pick<CleanEmailConfig, "smtpHost" | "smtpPort" | "encryption" | "smtpUsername" | "authEnabled" | "fromEmail" | "provider">;

/** A change to anything the server checks (or the From address) means the earlier test no longer proves anything. */
export function changeResetsVerification(before: Comparable, after: Comparable, passwordReplaced: boolean): boolean {
  return (
    passwordReplaced ||
    before.smtpHost !== after.smtpHost ||
    before.smtpPort !== after.smtpPort ||
    before.encryption !== after.encryption ||
    before.smtpUsername !== after.smtpUsername ||
    before.authEnabled !== after.authEnabled ||
    before.fromEmail !== after.fromEmail ||
    before.provider !== after.provider
  );
}
