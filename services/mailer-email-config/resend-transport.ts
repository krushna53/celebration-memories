import "server-only";
import { Resend } from "resend";

import { normalizeEmail } from "@/lib/mailer/email";
import { emailDomain } from "@/lib/mailer/email-config/validation";
import { isRestrictedKeyError, sanitizeResendError, type ResendErrorLike } from "@/lib/mailer/email-config/resend-errors";
import { EmailDeliveryError, type EmailAddress, type EmailTransport } from "@/services/mailer-email-config/transport";

/**
 * EmailTransport for the "Resend" provider: sends through Resend's HTTP API
 * with the company's own API key (stored encrypted like an SMTP password,
 * decrypted only in loadTransportForConfig). It returns Resend's email id
 * as the message id, so every recipient row points at the email in the
 * Resend dashboard.
 *
 * Separate from lib/email.ts, which sends the app's own notifications with
 * the platform's RESEND_API_KEY — this never reads that key.
 */

type ResendResult<T> = { data: T | null; error: ResendErrorLike | null };

/** What this transport needs from the Resend SDK — swappable in tests. */
export interface ResendTransportClient {
  emails: { send(payload: Record<string, unknown>): Promise<ResendResult<{ id: string }>> };
  domains: { list(): Promise<ResendResult<{ data: { name: string; status: string }[] }>> };
}

/** "Name" <address>, the format Resend expects; quotes keep commas etc. in the name harmless. */
function formatAddress(a: EmailAddress): string {
  const name = (a.name ?? "").replace(/["\\]/g, "").trim();
  return name ? `"${name}" <${a.address}>` : a.address;
}

const fail = (error: unknown): never => {
  throw new EmailDeliveryError(sanitizeResendError(error));
};

export function createResendTransport(apiKey: string, fromEmail: string, client?: ResendTransportClient): EmailTransport {
  const resend: ResendTransportClient = client ?? (new Resend(apiKey) as unknown as ResendTransportClient);
  const fromDomain = emailDomain(normalizeEmail(fromEmail));

  return {
    /**
     * Proves the key works. With a Full-access key it also checks the From
     * domain is verified in Resend; a Sending-access key can't list domains,
     * so the test email is what proves the sender then.
     */
    async verify() {
      let result: ResendResult<{ data: { name: string; status: string }[] }>;
      try {
        result = await resend.domains.list();
      } catch (err) {
        return fail(err);
      }
      if (result.error) {
        if (isRestrictedKeyError(result.error)) return;
        return fail(result.error);
      }
      if (fromDomain === "resend.dev") return;
      const domains = result.data?.data ?? [];
      const match = domains.find((d) => fromDomain === d.name.toLowerCase() || fromDomain.endsWith(`.${d.name.toLowerCase()}`));
      if (!match) {
        throw new EmailDeliveryError({
          kind: "sender_rejected",
          message: `The API key works, but ${fromDomain} isn't added in Resend yet. Add it in Resend → Domains, publish its DNS records and verify it.`,
          responseCode: null,
          retryable: false,
        });
      }
      if (match.status !== "verified") {
        throw new EmailDeliveryError({
          kind: "sender_rejected",
          message: `The API key works, but ${match.name} isn't verified in Resend yet (status: ${match.status.replace(/_/g, " ")}). Publish the DNS records Resend shows, then click Verify there.`,
          responseCode: null,
          retryable: true,
        });
      }
    },

    async send(email) {
      const payload: Record<string, unknown> = {
        from: formatAddress(email.from),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      };
      if (email.replyTo) payload.replyTo = formatAddress(email.replyTo);
      if (email.headers && Object.keys(email.headers).length) payload.headers = email.headers;

      let result: ResendResult<{ id: string }>;
      try {
        result = await resend.emails.send(payload);
      } catch (err) {
        return fail(err);
      }
      if (result.error) return fail(result.error);
      if (!result.data?.id) return fail({ name: "application_error" });
      return { messageId: result.data.id };
    },

    close() {
      // HTTP API — no connection to close.
    },
  };
}
