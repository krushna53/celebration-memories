/**
 * Preset options for invitees.invite_channel — how a guest's invite
 * actually reached them. Stored as plain text (not a DB enum) so this
 * list can grow without a migration; the admin form only offers these
 * presets today, chosen and set manually per invitee (see
 * features/admin/invitees/invitee-manager.tsx). Purely informational —
 * no application logic branches on this value.
 */
export const INVITE_CHANNEL_OPTIONS = [
  { value: "self_web", label: "Self (Web Link)" },
  { value: "whatsapp", label: "WhatsApp (Manual)" },
  { value: "phone_call", label: "Phone Call" },
  { value: "in_person", label: "In Person" },
  { value: "other", label: "Other" },
] as const;

export type InviteChannel = (typeof INVITE_CHANNEL_OPTIONS)[number]["value"];

export function inviteChannelLabel(value: string | null): string | null {
  if (!value) return null;
  return INVITE_CHANNEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
