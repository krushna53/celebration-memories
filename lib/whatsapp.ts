import { ACTIVE_EVENT, BUILDER } from "@/lib/constants";

/**
 * Default WhatsApp invite wording, used whenever an event doesn't have a
 * custom events.invite_message_template set. Kept here (not just inline)
 * so the admin Event Settings preview can show exactly this text as the
 * "default" option.
 */
export const DEFAULT_INVITE_MESSAGE_TEMPLATE =
  "Hello {{name}}\n{{hostedBy}} warmly invites you to celebrate {{honoreeName}}'s Birthday.\nPlease use your personal invitation\n{{link}}";

/** Placeholders an admin can use in a custom invite message template. */
export const INVITE_TEMPLATE_PLACEHOLDERS = [
  { token: "{{name}}", description: "Guest's name" },
  { token: "{{link}}", description: "Their unique invitation link" },
  { token: "{{hostedBy}}", description: "Who's hosting (e.g. Jagruti Shah)" },
  { token: "{{honoreeName}}", description: "Who it's for (e.g. Mahesh J. Shah)" },
] as const;

function interpolateTemplate(
  template: string,
  values: { name: string; link: string; hostedBy: string; honoreeName: string },
): string {
  return template
    .replaceAll("{{name}}", values.name)
    .replaceAll("{{link}}", values.link)
    .replaceAll("{{hostedBy}}", values.hostedBy)
    .replaceAll("{{honoreeName}}", values.honoreeName);
}

/**
 * Builds the wa.me deep link + pre-filled message for one invitee, per
 * CLAUDE.md → WhatsApp. This is deliberately a "tap to open WhatsApp
 * with the message ready" link, not an automated send — see the admin
 * Invitees page for why (no WhatsApp Business API / Meta approval
 * needed this way).
 *
 * If the event has a custom `messageTemplate` (from
 * events.invite_message_template), it's interpolated with
 * {{name}}/{{link}}/{{hostedBy}}/{{honoreeName}}. Otherwise falls back to
 * DEFAULT_INVITE_MESSAGE_TEMPLATE.
 */
export function buildWhatsAppInviteUrl(params: {
  guestName: string;
  phone: string;
  inviteUrl: string;
  hostedBy?: string;
  honoreeName?: string;
  messageTemplate?: string | null;
}): string {
  const {
    guestName,
    phone,
    inviteUrl,
    hostedBy = ACTIVE_EVENT.hostedBy,
    honoreeName = ACTIVE_EVENT.honoreeName,
    messageTemplate,
  } = params;

  const digitsOnly = phone.replace(/[^0-9]/g, "");

  const template = messageTemplate?.trim() || DEFAULT_INVITE_MESSAGE_TEMPLATE;
  const message = interpolateTemplate(template, {
    name: guestName,
    link: inviteUrl,
    hostedBy,
    honoreeName,
  });

  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

/** Renders a live preview of a template with sample values, for the admin settings form. */
export function previewInviteMessage(
  template: string | null | undefined,
  hostedBy: string,
  honoreeName: string,
): string {
  const t = template?.trim() || DEFAULT_INVITE_MESSAGE_TEMPLATE;
  return interpolateTemplate(t, {
    name: "Guest Name",
    link: "https://your-event.site/invite/ABC123",
    hostedBy,
    honoreeName,
  });
}

export const CREDIT_WHATSAPP_URL = BUILDER.whatsappUrl;
