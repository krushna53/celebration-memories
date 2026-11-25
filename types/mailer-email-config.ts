/**
 * Corporate Event Mailer — company email configuration (Phase 1).
 * Stored in mailer_email_configs (+ an encrypted secret in
 * mailer_email_config_secrets); see services/mailer-email-config/.
 *
 * EmailConfigView is the ONLY shape that ever reaches the browser: it has
 * `hasPassword`, never the password or its ciphertext.
 */

/**
 * "local" = Mailpit on this computer, for development only (lib/mailer/email-config/local-smtp.ts).
 * "resend" sends through Resend's HTTP API with the company's own API key
 * (services/mailer-email-config/resend-transport.ts), not SMTP.
 */
export type EmailProviderId = "google" | "microsoft" | "ses" | "sendgrid" | "brevo" | "resend" | "local" | "custom";
/** "none" (no TLS) is only ever accepted for the local Mailpit provider. */
export type SmtpEncryption = "ssl" | "starttls" | "none";
export type ConnectionStatus = "untested" | "ok" | "failed";
export type DnsRecordStatus = "not_configured" | "pending" | "verified" | "issue";

export interface DnsRecordCheck {
  status: DnsRecordStatus;
  /** One plain sentence for the admin. */
  detail: string;
  /** The record that was found, if any (public DNS data). */
  record: string | null;
}

export interface DomainCheck {
  domain: string;
  spf: DnsRecordCheck;
  dkim: DnsRecordCheck;
  dmarc: DnsRecordCheck;
  overall: DnsRecordStatus;
  checkedAt: string;
}

export interface EmailConfigView {
  id: string;
  label: string;
  provider: EmailProviderId;
  senderName: string;
  fromEmail: string;
  replyToEmail: string | null;
  replyToName: string | null;
  smtpHost: string;
  smtpPort: number;
  encryption: SmtpEncryption;
  smtpUsername: string | null;
  authEnabled: boolean;
  isDefault: boolean;
  sendingEnabled: boolean;
  dkimSelector: string | null;
  /** True when a password is stored. The password itself is never sent to the browser. */
  hasPassword: boolean;
  passwordUpdatedAt: string | null;
  connectionStatus: ConnectionStatus;
  connectionCheckedAt: string | null;
  /** Already sanitised (lib/mailer/email-config/smtp-errors.ts) — never raw server output. */
  connectionError: string | null;
  verifiedAt: string | null;
  domainCheck: DomainCheck | null;
  updatedAt: string;
}

/** What the form submits. `newPassword` empty = keep the stored one. */
export interface EmailConfigInput {
  label: string;
  provider: EmailProviderId;
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  replyToName: string;
  smtpHost: string;
  smtpPort: number;
  encryption: SmtpEncryption;
  smtpUsername: string;
  authEnabled: boolean;
  newPassword: string;
  dkimSelector: string;
  isDefault: boolean;
  sendingEnabled: boolean;
}

/** Overall state shown as the configuration's badge (lib/mailer/email-config/status.ts). */
export type EmailConfigState =
  | "incomplete"
  | "untested"
  | "connection_failed"
  | "connection_ok"
  | "domain_pending"
  | "verified";
