import type { EmailProviderId, SmtpEncryption } from "@/types/mailer-email-config";
import { LOCAL_SMTP_PORT, MAILPIT_INBOX_URL } from "@/lib/mailer/email-config/local-smtp";

/**
 * Email providers the configuration screen offers. Everything provider-
 * specific lives here (defaults, help text, DNS guidance), so adding a
 * provider is one new entry — the transport (services/mailer-email-config/
 * transport.ts) only ever sees host/port/encryption/credentials.
 *
 * Values are starting points: the provider's own dashboard is the source
 * of truth for exact hosts, limits and DNS records, and the help text says
 * so rather than promising more than we can check.
 */

export interface EmailProviderPreset {
  id: EmailProviderId;
  label: string;
  /** Pre-filled when the provider is picked; the admin can still change it. */
  host: string;
  port: number;
  encryption: SmtpEncryption;
  /** Pre-filled username (e.g. SendGrid's literal "apikey"); empty = the admin's own. */
  username: string;
  usernameHint: string;
  passwordLabel: string;
  passwordHint: string;
  /** Whether sending without SMTP authentication makes sense (IP-allowlisted relays only). */
  allowsNoAuth: boolean;
  /** SPF `include:` that must appear in the From domain's SPF record, when the provider has a fixed one. */
  spfInclude: string | null;
  /** Usual DKIM selector, when the provider uses a fixed one. */
  dkimSelector: string | null;
  dnsHelp: string[];
  /** Plain-language sending limits, so nobody assumes "unlimited". */
  limitsNote: string;
  /** Shown as a caution, e.g. password-based SMTP being phased out. */
  caution: string | null;
  /** Development-only provider (Mailpit) — hidden unless local SMTP is allowed (local-smtp.ts). */
  localOnly?: boolean;
  /**
   * Sends through the provider's HTTP API, not SMTP: the form asks only for
   * the API key (stored like a password), and host/port/username are fixed
   * to the preset's values.
   */
  apiOnly?: boolean;
}

/** Development only (Mailpit) — listed just before "custom", which must stay last (getProvider's fallback). */
const LOCAL_PROVIDER: EmailProviderPreset = {
  id: "local",
  label: "Local test (Mailpit)",
  host: "127.0.0.1",
  port: LOCAL_SMTP_PORT,
  encryption: "none",
  username: "",
  usernameHint: "Mailpit doesn't need a login — leave it off.",
  passwordLabel: "Password",
  passwordHint: "Not needed for Mailpit.",
  allowsNoAuth: true,
  spfInclude: null,
  dkimSelector: null,
  dnsHelp: ["Local testing only — no DNS records are needed. Emails never leave this computer."],
  limitsNote: `Mailpit catches every email on this computer — nothing reaches a real inbox. Read them at ${MAILPIT_INBOX_URL}.`,
  caution: "Development only: works under npm run dev with MAILER_ALLOW_LOCAL_SMTP=true and Mailpit running in Docker. Never used on the live site.",
  localOnly: true,
};

export const EMAIL_PROVIDERS: readonly EmailProviderPreset[] = [
  {
    id: "google",
    label: "Google Workspace / Gmail",
    host: "smtp.gmail.com",
    port: 465,
    encryption: "ssl",
    username: "",
    usernameHint: "The full mailbox address, e.g. greetings@yourcompany.com",
    passwordLabel: "App password",
    passwordHint: "Create a 16-character app password in the Google account (needs 2-Step Verification). Your normal password won't work.",
    allowsNoAuth: false,
    spfInclude: "_spf.google.com",
    dkimSelector: "google",
    dnsHelp: [
      "SPF: one TXT record on your domain, e.g. v=spf1 include:_spf.google.com ~all (merge with any existing SPF record — a domain must have only one).",
      "DKIM: in the Google Admin console → Apps → Gmail → Authenticate email, generate a key and add the TXT record it shows (selector is usually \"google\"), then click Start authentication.",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain — move to p=quarantine once mail is passing.",
    ],
    limitsNote: "Google limits each mailbox to a daily number of recipients (roughly 2,000/day on Workspace, far fewer on free Gmail). Check Google's current limits before large campaigns.",
    caution: "Google is moving accounts away from password-based sign-in for SMTP. App passwords work today; a dedicated sending service (SES, SendGrid, Brevo) is better for large campaigns.",
  },
  {
    id: "microsoft",
    label: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    encryption: "starttls",
    username: "",
    usernameHint: "The full mailbox address",
    passwordLabel: "Password / app password",
    passwordHint: "SMTP AUTH must be turned on for this mailbox in the Microsoft 365 admin center.",
    allowsNoAuth: false,
    spfInclude: "spf.protection.outlook.com",
    dkimSelector: "selector1",
    dnsHelp: [
      "SPF: v=spf1 include:spf.protection.outlook.com -all (merge with any existing SPF record).",
      "DKIM: in Microsoft Defender → Email authentication → DKIM, publish the two CNAME records (selector1 and selector2) and enable signing.",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.",
    ],
    limitsNote: "Microsoft 365 mailboxes have daily recipient limits (around 10,000 recipients/day) and per-minute limits. Check your tenant's limits.",
    caution: "Microsoft is phasing out password-based SMTP AUTH. Prefer a dedicated sending service for campaigns; OAuth sign-in is planned here later.",
  },
  {
    id: "ses",
    label: "Amazon SES",
    host: "email-smtp.ap-south-1.amazonaws.com",
    port: 587,
    encryption: "starttls",
    username: "",
    usernameHint: "SES SMTP username (from SES → SMTP settings → Create SMTP credentials — not your AWS access key)",
    passwordLabel: "SMTP password",
    passwordHint: "The SMTP password SES generated with the username. Change the host's region to match your SES region.",
    allowsNoAuth: false,
    spfInclude: null,
    dkimSelector: null,
    dnsHelp: [
      "Verify your domain in SES → Identities. SES shows three DKIM CNAME records (Easy DKIM) — add all three. To check one here, enter the token before ._domainkey as the DKIM selector.",
      "SPF: only needed if you set a custom MAIL FROM domain in SES; then add the MX and TXT (v=spf1 include:amazonses.com ~all) records SES shows for that subdomain.",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.",
      "New SES accounts start in the sandbox and can only email verified addresses until you request production access.",
    ],
    limitsNote: "SES enforces a daily sending quota and a per-second rate per account and region (shown in the SES console).",
    caution: null,
  },
  {
    id: "sendgrid",
    label: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    encryption: "starttls",
    username: "apikey",
    usernameHint: "Always the literal word apikey",
    passwordLabel: "API key",
    passwordHint: "A SendGrid API key with Mail Send permission.",
    allowsNoAuth: false,
    spfInclude: null,
    dkimSelector: "s1",
    dnsHelp: [
      "In SendGrid → Settings → Sender Authentication → Authenticate your domain, add the CNAME records it shows (they cover DKIM — selectors s1 and s2 — and SPF/return path).",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.",
    ],
    limitsNote: "SendGrid limits depend on your plan (the free plan has a small daily cap).",
    caution: null,
  },
  {
    id: "brevo",
    label: "Brevo",
    host: "smtp-relay.brevo.com",
    port: 587,
    encryption: "starttls",
    username: "",
    usernameHint: "The SMTP login shown in Brevo → SMTP & API",
    passwordLabel: "SMTP key",
    passwordHint: "An SMTP key from Brevo → SMTP & API (not your account password).",
    allowsNoAuth: false,
    spfInclude: null,
    dkimSelector: null,
    dnsHelp: [
      "In Brevo → Senders, Domains & Dedicated IPs → Domains, add your domain and publish the records it lists (Brevo code, DKIM and DMARC). Enter the DKIM selector Brevo shows to check it here.",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.",
    ],
    limitsNote: "Brevo limits daily sends by plan (the free plan has a small daily cap).",
    caution: null,
  },
  {
    id: "resend",
    label: "Resend",
    // Kept only so the stored row is complete — Resend configurations send through Resend's API, never SMTP.
    host: "smtp.resend.com",
    port: 465,
    encryption: "ssl",
    username: "resend",
    usernameHint: "Not needed — Resend only uses the API key.",
    passwordLabel: "API key",
    passwordHint: "A Resend API key (starts with re_) from Resend → API Keys. \"Sending access\" is enough; \"Full access\" also lets the test check that your From domain is verified.",
    allowsNoAuth: false,
    // Resend's SPF record lives on a send. subdomain, so the root-domain SPF check doesn't apply.
    spfInclude: null,
    dkimSelector: "resend",
    dnsHelp: [
      "In Resend → Domains → Add domain, add your domain and publish every record Resend lists exactly as shown — the resend._domainkey TXT record (DKIM) and the records under \"Enable Sending\" (SPF / return path, on the send subdomain) — then click Verify there.",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.",
      "Until a domain is verified you can only send from onboarding@resend.dev, and only to the email address of your own Resend account.",
    ],
    limitsNote: "Resend limits sending by plan (the free plan allows 100 emails a day and 3,000 a month) and to a few requests per second.",
    caution: null,
    apiOnly: true,
  },
  LOCAL_PROVIDER,
  {
    id: "custom",
    label: "Other SMTP server",
    host: "",
    port: 587,
    encryption: "starttls",
    username: "",
    usernameHint: "Usually the full mailbox address",
    passwordLabel: "Password",
    passwordHint: "Ask your IT team or hosting provider for the SMTP details.",
    allowsNoAuth: true,
    spfInclude: null,
    dkimSelector: null,
    dnsHelp: [
      "SPF: your domain's single SPF TXT record must authorise this SMTP server (ask your provider which include: or ip4: to add).",
      "DKIM: ask your provider for the DKIM selector and TXT record, publish it, and enter the selector here to check it.",
      "DMARC: a TXT record at _dmarc.yourdomain, e.g. v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.",
    ],
    limitsNote: "Most hosting providers cap emails per hour or per day — ask yours before sending large campaigns.",
    caution: null,
  },
];


export function getProvider(id: EmailProviderId): EmailProviderPreset {
  return EMAIL_PROVIDERS.find((p) => p.id === id) ?? EMAIL_PROVIDERS[EMAIL_PROVIDERS.length - 1]!;
}

/** SMTP submission ports we allow. Anything else is refused (also keeps the test from probing arbitrary services). */
export const SMTP_PORTS = [465, 587, 2525, 25] as const;

/** Port 465 is implicit TLS; the others start plain and must upgrade with STARTTLS. Mailpit's 1025 has no TLS. */
export function encryptionForPort(port: number): SmtpEncryption {
  if (port === LOCAL_SMTP_PORT) return "none";
  return port === 465 ? "ssl" : "starttls";
}
