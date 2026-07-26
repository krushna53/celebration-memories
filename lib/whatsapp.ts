import { ACTIVE_EVENT, BUILDER } from "@/lib/constants";

/**
 * Builds the wa.me deep link + pre-filled message for one invitee, per
 * CLAUDE.md → WhatsApp. This is deliberately a "tap to open WhatsApp
 * with the message ready" link, not an automated send — see the admin
 * Invitees page for why (no WhatsApp Business API / Meta approval
 * needed this way).
 */
export function buildWhatsAppInviteUrl(params: {
  guestName: string;
  phone: string;
  inviteUrl: string;
  hostedBy?: string;
  honoreeName?: string;
}): string {
  const { guestName, phone, inviteUrl, hostedBy = ACTIVE_EVENT.hostedBy, honoreeName = ACTIVE_EVENT.honoreeName } =
    params;

  const digitsOnly = phone.replace(/[^0-9]/g, "");

  const message = [
    `Hello ${guestName}`,
    `${hostedBy} warmly invites you to celebrate ${honoreeName}'s Birthday.`,
    `Please use your personal invitation`,
    inviteUrl,
  ].join("\n");

  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

export const CREDIT_WHATSAPP_URL = BUILDER.whatsappUrl;
