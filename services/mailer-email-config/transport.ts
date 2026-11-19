import "server-only";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import type { SmtpEncryption } from "@/types/mailer-email-config";
import { sanitizeSmtpError, type SafeSmtpError } from "@/lib/mailer/email-config/smtp-errors";
import { resolvePublicAddress } from "@/services/mailer-email-config/network";
import { isLocalSmtpHost, LOCAL_SMTP_PORT, localSmtpAllowed } from "@/lib/mailer/email-config/local-smtp";

/**
 * The common delivery interface. Campaign sending (Phase 2) and the
 * configuration tests only talk to EmailTransport; SMTP is the first
 * implementation. A provider API (SES/SendGrid HTTP) or OAuth-based
 * Gmail/Microsoft transport can be added as another factory without
 * touching callers.
 *
 * Every failure leaves here as an EmailDeliveryError whose message is
 * already sanitised — raw library errors never escape this module.
 */

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface OutgoingEmail {
  from: EmailAddress;
  replyTo: EmailAddress | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe (Phase 2). */
  headers?: Record<string, string>;
}

export interface EmailTransport {
  /** Connects, negotiates TLS and logs in, without sending anything. */
  verify(): Promise<void>;
  send(email: OutgoingEmail): Promise<{ messageId: string | null }>;
  close(): void;
}

export class EmailDeliveryError extends Error {
  constructor(readonly safe: SafeSmtpError) {
    super(safe.message);
    this.name = "EmailDeliveryError";
  }
}

export interface SmtpSettings {
  host: string;
  port: number;
  encryption: SmtpEncryption;
  auth: { user: string; pass: string } | null;
}

export async function createSmtpTransport(settings: SmtpSettings): Promise<EmailTransport> {
  const ctx = { host: settings.host, port: settings.port };
  const fail = (err: unknown): never => {
    throw new EmailDeliveryError(sanitizeSmtpError(err, ctx));
  };

  // Mailpit (development only): re-checked here, on every connection, not just when the settings were saved.
  const local = settings.encryption === "none";
  if (local && (!localSmtpAllowed() || !isLocalSmtpHost(settings.host) || settings.port !== LOCAL_SMTP_PORT)) {
    throw new EmailDeliveryError({
      kind: "blocked_host",
      message: "Local test SMTP (Mailpit) only works under npm run dev with MAILER_ALLOW_LOCAL_SMTP=true.",
      responseCode: null,
      retryable: false,
    });
  }

  let address: string;
  if (local) {
    address = "127.0.0.1";
  } else {
    try {
      address = await resolvePublicAddress(settings.host);
    } catch (err) {
      return fail(err);
    }
  }

  const options: SMTPTransport.Options = {
    // Connect to the address we checked; TLS still verifies the certificate against the real host name.
    host: address,
    port: settings.port,
    secure: settings.encryption === "ssl",
    requireTLS: settings.encryption === "starttls",
    // Only Mailpit on this computer may skip TLS.
    ignoreTLS: local,
    auth: settings.auth ?? undefined,
    tls: { servername: settings.host, minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
    dnsTimeout: 5_000,
    // Never log the SMTP conversation — it can include the login.
    logger: false,
    debug: false,
  };
  const transporter = nodemailer.createTransport(options);

  return {
    async verify() {
      try {
        await transporter.verify();
      } catch (err) {
        fail(err);
      }
    },
    async send(email) {
      try {
        const info = await transporter.sendMail({
          from: { name: email.from.name ?? "", address: email.from.address },
          replyTo: email.replyTo ? { name: email.replyTo.name ?? "", address: email.replyTo.address } : undefined,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
          // Content is ours, but never let it pull in local files or remote URLs.
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (info.rejected.length > 0) fail({ code: "EENVELOPE", command: "RCPT TO" });
        return { messageId: info.messageId ?? null };
      } catch (err) {
        if (err instanceof EmailDeliveryError) throw err;
        return fail(err);
      }
    },
    close() {
      transporter.close();
    },
  };
}
