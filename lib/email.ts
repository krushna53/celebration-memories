import "server-only";
import { Resend } from "resend";

import { SITE_NAME } from "@/lib/constants";

/**
 * Thin wrapper around Resend for transactional email (inquiry
 * notifications, RSVP confirmations). Every function here is a no-op
 * (logs and returns) when RESEND_API_KEY isn't set, so the app works
 * identically without it configured — email is an enhancement, never a
 * hard dependency for a Server Action to succeed.
 *
 * Deliverability note: landing in the inbox instead of spam is mostly
 * about sender domain verification (SPF/DKIM/DMARC records), not the
 * provider. Resend's onboarding domain (onboarding@resend.dev) works
 * for testing but is more likely to get filtered; verify your own
 * domain in the Resend dashboard and set RESEND_FROM_EMAIL to an
 * address on it (e.g. notifications@krushnawebworks.com) before relying
 * on this for real guest-facing email. See README for the full setup.
 */

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || `${SITE_NAME} <onboarding@resend.dev>`;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const client = getClient();
  if (!client) {
    console.info(`[email skipped — RESEND_API_KEY not set] to=${to} subject="${subject}"`);
    return;
  }

  const { error } = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    html,
  });

  if (error) {
    // Email failures should never break the Server Action that
    // triggered them (an inquiry/RSVP is already saved in the DB by
    // this point) — log and move on rather than throwing.
    console.error(`Failed to send email to ${to}:`, error);
  }
}

/**
 * Notifies the admin (ADMIN_NOTIFICATION_EMAIL, falling back to the
 * platform's own email) of a new inquiry — submitted either via the
 * public Contact Us page or the site-wide support widget's "leave your
 * details" form (features/support/support-chat-widget.tsx). Both share
 * the same `inquiries` table/pipeline; the widget is effectively a
 * second entry point into it, framed as "someone had trouble and
 * reached out" rather than a general question.
 */
export async function sendInquiryNotification(input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "krushnawebworks@gmail.com";

  await sendEmail({
    to: adminEmail,
    subject: `New inquiry from ${input.name} — ${SITE_NAME}`,
    html: `
      <p><strong>${escapeHtml(input.name)}</strong> (${escapeHtml(input.email)}${input.phone ? `, ${escapeHtml(input.phone)}` : ""}) sent a message:</p>
      <blockquote style="border-left:3px solid #ff6b57;margin:0;padding-left:12px;color:#333;">
        ${escapeHtml(input.message).replace(/\n/g, "<br />")}
      </blockquote>
      <p style="color:#888;font-size:12px;">Reply directly to this guest at ${escapeHtml(input.email)}, or view it in /admin/inquiries.</p>
    `,
  });
}

/** Confirms a guest's RSVP to their own email, when they provided one. */
export async function sendRsvpConfirmation(input: {
  guestEmail: string;
  guestName: string;
  honoreeName: string;
  eventTitle: string;
  coming: "coming" | "maybe" | "not_coming";
  eventUrl: string;
}): Promise<void> {
  const comingLabel =
    input.coming === "coming" ? "joyfully accepted" : input.coming === "maybe" ? "marked as maybe" : "regretfully declined";

  await sendEmail({
    to: input.guestEmail,
    subject: `Your RSVP for ${input.honoreeName}'s ${input.eventTitle}`,
    html: `
      <p>Hi ${escapeHtml(input.guestName)},</p>
      <p>This confirms your RSVP has been recorded — you ${comingLabel}.</p>
      <p>You can revisit your invitation anytime to update your response: <a href="${input.eventUrl}">${input.eventUrl}</a></p>
      <p style="color:#888;font-size:12px;">Sent by ${SITE_NAME}.</p>
    `,
  });
}

/**
 * Notifies the owner (ADMIN_NOTIFICATION_EMAIL, falling back to the
 * platform's own email) when a client requests a custom domain from
 * the admin dashboard's FAQ chatbot (features/admin/support/faq-chatbot.tsx).
 * The request is also saved to the `inquiries` table via createInquiry
 * so it shows up in /admin/inquiries even if this email doesn't land —
 * see features/admin/support/actions.ts.
 */
export async function sendCustomDomainRequestNotification(input: {
  adminName: string;
  adminEmail: string;
  eventSlug: string;
  domain: string;
  notes: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "krushnawebworks@gmail.com";

  await sendEmail({
    to: adminEmail,
    subject: `Custom domain request from ${input.adminName} (${input.eventSlug})`,
    html: `
      <p><strong>${escapeHtml(input.adminName)}</strong> (${escapeHtml(input.adminEmail)}) requested a custom domain
      for their event (<code>${escapeHtml(input.eventSlug)}</code>):</p>
      <p style="font-size:16px;"><strong>${escapeHtml(input.domain)}</strong></p>
      ${input.notes ? `<blockquote style="border-left:3px solid #ff6b57;margin:0;padding-left:12px;color:#333;">${escapeHtml(input.notes).replace(/\n/g, "<br />")}</blockquote>` : ""}
      <p style="color:#888;font-size:12px;">Reply directly to ${escapeHtml(input.adminEmail)}, or view it in /admin/inquiries.</p>
    `,
  });
}

/**
 * Notifies the admin (ADMIN_NOTIFICATION_EMAIL, falling back to the
 * platform's own email) whenever someone submits an "I've paid"
 * confirmation on /pay or the wizard's QR fallback (see
 * features/pay/actions.ts's submitPaymentAction). This is the only
 * signal the admin gets for a QR/UPI payment — there's no webhook the
 * way Stripe/Razorpay checkout has — so it doubles as their receipt
 * notification / to-do to verify the payment in /admin/payments.
 */
export async function sendPaymentSubmissionNotification(input: {
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
  amount: number;
  purpose: string | null;
  referenceNote: string | null;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "krushnawebworks@gmail.com";

  await sendEmail({
    to: adminEmail,
    subject: `Payment confirmation from ${input.payerName} — ₹${input.amount.toFixed(2)}`,
    html: `
      <p><strong>${escapeHtml(input.payerName)}</strong> says they've made a payment of
      <strong>₹${input.amount.toFixed(2)}</strong>${input.purpose ? ` for ${escapeHtml(input.purpose)}` : ""}.</p>
      <ul style="padding-left:18px;color:#333;">
        ${input.payerEmail ? `<li>Email: ${escapeHtml(input.payerEmail)}</li>` : ""}
        ${input.payerPhone ? `<li>Phone: ${escapeHtml(input.payerPhone)}</li>` : ""}
        ${input.referenceNote ? `<li>Reference / UTR: ${escapeHtml(input.referenceNote)}</li>` : ""}
      </ul>
      <p style="color:#888;font-size:12px;">Verify and mark this confirmed or rejected in /admin/payments.</p>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
