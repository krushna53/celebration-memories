import "server-only";
import { Resend } from "resend";

import { SITE_NAME, WIZARD_LEAD_NOTIFICATION } from "@/lib/constants";
import { buildLeadOutreachWhatsAppUrl } from "@/lib/whatsapp";

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

/**
 * Notifies an event's admin(s) — the client host and/or the owner, see
 * services/admin-notifications.ts's getAdminsToNotifyForEvent — when a
 * guest submits an RSVP. Sent to the admin's own account email (not the
 * fixed ADMIN_NOTIFICATION_EMAIL like the functions above), since this
 * is meant to reach the actual event host, not just the platform
 * owner's inbox. Paired with an in-app admin_notifications row created
 * alongside this — see features/rsvp/actions.ts.
 */
export async function sendRsvpSubmittedNotification(input: {
  adminEmail: string;
  guestName: string;
  honoreeName: string;
  eventTitle: string;
  coming: "coming" | "maybe" | "not_coming";
  adminDashboardUrl: string;
}): Promise<void> {
  const comingLabel =
    input.coming === "coming" ? "is coming" : input.coming === "maybe" ? "might come" : "can't make it";

  await sendEmail({
    to: input.adminEmail,
    subject: `RSVP: ${input.guestName} ${comingLabel} — ${input.honoreeName}'s ${input.eventTitle}`,
    html: `
      <p><strong>${escapeHtml(input.guestName)}</strong> just submitted an RSVP and ${comingLabel}.</p>
      <p style="color:#888;font-size:12px;">View the full guest list at <a href="${input.adminDashboardUrl}">${input.adminDashboardUrl}</a>.</p>
    `,
  });
}

/**
 * The one-time code a client must enter to confirm permanently deleting
 * their own account/event (task #71) — see
 * features/admin/delete-account/actions.ts. Deliberately blunt/urgent
 * copy since this is the last checkpoint before an irreversible action.
 */
export async function sendAccountDeletionCode(input: {
  to: string;
  code: string;
  eventTitle: string;
  minutesValid: number;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `Your account deletion code — ${SITE_NAME}`,
    html: `
      <p>Someone (hopefully you) requested to permanently delete your ${SITE_NAME} account and everything in <strong>${escapeHtml(input.eventTitle)}</strong> — every guest, RSVP, photo, video, and message.</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:20px 0;">${escapeHtml(input.code)}</p>
      <p>Enter this code on the Delete Account page to confirm. It expires in ${input.minutesValid} minutes.</p>
      <p style="color:#888;font-size:12px;">If you didn't request this, ignore this email — nothing will be deleted without the code.</p>
    `,
  });
}

/**
 * Notifies Krushna Web Works (WIZARD_LEAD_NOTIFICATION.email, a fixed
 * inbox — see that constant's doc comment) whenever a would-be host
 * reaches the self-serve wizard's "Create Account" step but doesn't make
 * it through cleanly — either the signup call itself errored, or they
 * typed something in and left without submitting (see
 * services/wizard-leads.ts's recordWizardAccountLead, the single call
 * site for this). Includes a one-tap "Message them on WhatsApp" link
 * when a phone number was captured, since there's no WhatsApp Business
 * API wired into this app to send that message automatically.
 */
export async function sendWizardAccountLeadNotification(input: {
  name: string | null;
  email: string | null;
  phone: string | null;
  reason: "error" | "abandoned";
  errorMessage: string | null;
  eventTitle: string | null;
}): Promise<void> {
  const whatsappUrl = buildLeadOutreachWhatsAppUrl(input.name, input.phone);
  const headline =
    input.reason === "error"
      ? "hit an error while creating their account"
      : "started creating an account but didn't finish";

  await sendEmail({
    to: WIZARD_LEAD_NOTIFICATION.email,
    subject: `Signup drop-off: ${input.name || input.email || "a visitor"} — ${SITE_NAME}`,
    html: `
      <p><strong>${escapeHtml(input.name || "Someone")}</strong> ${headline} on ${SITE_NAME}'s self-serve wizard.</p>
      <ul style="padding-left:18px;color:#333;">
        ${input.email ? `<li>Email: ${escapeHtml(input.email)}</li>` : "<li>Email: not captured</li>"}
        ${input.phone ? `<li>Phone: ${escapeHtml(input.phone)}</li>` : "<li>Phone: not captured</li>"}
        ${input.eventTitle ? `<li>Event in progress: ${escapeHtml(input.eventTitle)}</li>` : ""}
        ${input.errorMessage ? `<li>Error: ${escapeHtml(input.errorMessage)}</li>` : ""}
      </ul>
      ${
        whatsappUrl
          ? `<p><a href="${whatsappUrl}" style="display:inline-block;background:#ff6b57;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Message them on WhatsApp</a></p>`
          : `<p style="color:#888;font-size:12px;">No phone number was captured, so there's no WhatsApp link — email is the only follow-up channel for this one.</p>`
      }
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
