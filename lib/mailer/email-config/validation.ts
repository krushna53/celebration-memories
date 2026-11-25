import type { EmailConfigInput, EmailProviderId, SmtpEncryption } from "@/types/mailer-email-config";
import { isValidEmail, normalizeEmail } from "@/lib/mailer/email";
import { encryptionForPort, getProvider, SMTP_PORTS } from "@/lib/mailer/email-config/providers";
import { isLocalSmtpHost, LOCAL_SMTP_PORT } from "@/lib/mailer/email-config/local-smtp";

/**
 * Server-side validation for the Email Configuration form. Pure, so it's
 * unit-tested (tests/mailer-email-config.cjs); the form shows the same
 * messages, but this is the check that counts.
 */

export interface CleanEmailConfig {
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
  /** null = keep the stored password. */
  newPassword: string | null;
  dkimSelector: string | null;
  isDefault: boolean;
  sendingEnabled: boolean;
}

export type ValidationResult = { ok: true; value: CleanEmailConfig } | { ok: false; field: keyof EmailConfigInput; error: string };

const PROVIDER_IDS: readonly EmailProviderId[] = ["google", "microsoft", "ses", "sendgrid", "brevo", "resend", "local", "custom"];
/** Resend API keys look like re_xxxxxxxx… */
const RESEND_KEY = /^re_[A-Za-z0-9_-]{8,}$/;
// Control characters (incl. CR/LF) would let a value smuggle extra email headers.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const DKIM_SELECTOR = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

export const PASSWORD_MAX = 512;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmailConfig(
  input: EmailConfigInput,
  options: { hasStoredPassword: boolean; /** Mailpit allowed here (local-smtp.ts) — the server passes localSmtpAllowed(). */ allowLocalSmtp?: boolean },
): ValidationResult {
  const fail = (field: keyof EmailConfigInput, error: string): ValidationResult => ({ ok: false, field, error });

  const provider = input.provider;
  if (!PROVIDER_IDS.includes(provider)) return fail("provider", "Pick an email provider.");
  const preset = getProvider(provider);
  const isLocal = provider === "local";
  if (isLocal && !options.allowLocalSmtp) {
    return fail("provider", "Local test (Mailpit) only works under npm run dev with MAILER_ALLOW_LOCAL_SMTP=true in .env.local.");
  }

  const label = text(input.label).replace(/\s+/g, " ");
  if (!label) return fail("label", "Give this configuration a name, e.g. \"HR greetings\".");
  if (label.length > 60) return fail("label", "Keep the name under 60 characters.");

  // Control characters are checked before spaces are tidied, so a line break is refused rather than quietly flattened.
  if (CONTROL_CHARS.test(text(input.senderName))) return fail("senderName", "The sender name can't contain line breaks or control characters.");
  const senderName = text(input.senderName).replace(/\s+/g, " ");
  if (!senderName) return fail("senderName", "Add the sender name people will see, e.g. \"ABC Technologies HR Team\".");
  if (senderName.length > 80) return fail("senderName", "Keep the sender name under 80 characters.");

  const fromEmail = normalizeEmail(text(input.fromEmail));
  if (!fromEmail) return fail("fromEmail", "Add the From email address.");
  // Mailpit setups often use a made-up local address like test@localhost.
  const localFrom = isLocal && /^[a-z0-9._%+-]{1,64}@localhost$/.test(fromEmail);
  if (fromEmail.length > 254 || (!isValidEmail(fromEmail) && !localFrom)) return fail("fromEmail", "The From address isn't a valid email address.");

  const replyRaw = normalizeEmail(text(input.replyToEmail));
  if (replyRaw && (replyRaw.length > 254 || !isValidEmail(replyRaw))) return fail("replyToEmail", "The Reply-To address isn't a valid email address.");
  if (CONTROL_CHARS.test(text(input.replyToName))) return fail("replyToName", "The Reply-To name can't contain line breaks or control characters.");
  const replyToName = text(input.replyToName).replace(/\s+/g, " ");
  if (replyToName.length > 80) return fail("replyToName", "Keep the Reply-To name under 80 characters.");
  if (replyToName && !replyRaw) return fail("replyToEmail", "Add the Reply-To address for this Reply-To name.");

  // API providers (Resend) have no SMTP settings to fill in — the preset's values are stored as-is.
  const api = preset.apiOnly === true;
  const smtpHost = api ? preset.host : text(input.smtpHost).toLowerCase().replace(/\.$/, "");
  if (!smtpHost) return fail("smtpHost", "Add the SMTP host, e.g. smtp.gmail.com.");
  const smtpPort = api ? preset.port : Number(input.smtpPort);
  const encryption = api ? preset.encryption : input.encryption;

  if (api) {
    // Nothing to check: fixed values above.
  } else if (isLocal) {
    // Mailpit: the only place a local address, port 1025 and no TLS are accepted.
    if (!isLocalSmtpHost(smtpHost)) return fail("smtpHost", "Local testing uses 127.0.0.1 (Mailpit running on this computer).");
    if (smtpPort !== LOCAL_SMTP_PORT) return fail("smtpPort", `Mailpit listens on port ${LOCAL_SMTP_PORT}.`);
    if (encryption !== "none") return fail("encryption", "Mailpit runs without encryption — pick None.");
  } else {
    if (!HOSTNAME.test(smtpHost)) return fail("smtpHost", "Enter the SMTP server's host name (like smtp.example.com), not an IP address or URL.");
    if (!(SMTP_PORTS as readonly number[]).includes(smtpPort)) return fail("smtpPort", `Use one of the standard SMTP ports: ${SMTP_PORTS.join(", ")}.`);
    if (encryption !== "ssl" && encryption !== "starttls") return fail("encryption", "Pick SSL/TLS or STARTTLS.");
    if (encryption !== encryptionForPort(smtpPort)) {
      return fail("encryption", smtpPort === 465 ? "Port 465 uses SSL/TLS." : `Port ${smtpPort} uses STARTTLS (SSL/TLS is for port 465).`);
    }
  }

  const authEnabled = api || input.authEnabled !== false;
  if (!authEnabled && !preset.allowsNoAuth) return fail("authEnabled", `${preset.label} needs a username and password.`);

  const smtpUsername = api ? preset.username : text(input.smtpUsername);
  if (smtpUsername.length > 254) return fail("smtpUsername", "The username is too long.");
  if (CONTROL_CHARS.test(smtpUsername)) return fail("smtpUsername", "The username can't contain line breaks or control characters.");
  if (authEnabled && !smtpUsername) return fail("smtpUsername", "Add the SMTP username.");

  // Passwords are not trimmed — spaces can be part of one (Google shows app passwords in groups).
  const rawPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  // An API key never has spaces, so a copy-paste's stray whitespace is dropped.
  const newPassword = rawPassword.trim() ? (api ? rawPassword.trim() : rawPassword) : null;
  if (newPassword && newPassword.length > PASSWORD_MAX) return fail("newPassword", "That password is too long.");
  if (authEnabled && !newPassword && !options.hasStoredPassword) return fail("newPassword", `Add the ${preset.passwordLabel.toLowerCase()}.`);
  if (provider === "resend" && newPassword && !RESEND_KEY.test(newPassword)) {
    return fail("newPassword", "That doesn't look like a Resend API key — it starts with re_ (Resend → API Keys).");
  }

  const dkimSelector = text(input.dkimSelector);
  if (dkimSelector && !DKIM_SELECTOR.test(dkimSelector)) return fail("dkimSelector", "A DKIM selector is letters, numbers, dots, dashes or underscores (e.g. google, s1).");

  return {
    ok: true,
    value: {
      label,
      provider,
      senderName,
      fromEmail,
      replyToEmail: replyRaw || null,
      replyToName: replyToName || null,
      smtpHost,
      smtpPort,
      encryption,
      smtpUsername: authEnabled ? smtpUsername : null,
      authEnabled,
      newPassword: authEnabled ? newPassword : null,
      dkimSelector: dkimSelector || null,
      isDefault: Boolean(input.isDefault),
      sendingEnabled: input.sendingEnabled !== false,
    },
  };
}

/** The domain part of an address (the From domain that SPF/DKIM/DMARC are checked on). */
export function emailDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}
