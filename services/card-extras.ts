import "server-only";

import { CARD_TEMPLATE_SLUG, sanitizeCardTheme } from "@/lib/card-theme";
import { DEFAULT_TEMPLATE_SLUG } from "@/lib/template-catalog";
import type { InvitationCardDetails } from "@/lib/ai-invitation-card-reader";
import { updateEvent } from "@/services/events";
import { normaliseWhatsAppNumber, saveEventCardTheme, saveEventWhatsAppContact } from "@/services/event-extras";

/**
 * The parts of an invitation-card read that go beyond the event's text
 * fields: the WhatsApp contact number and the card's look. Saves what was
 * found and returns friendly labels for the "we filled in…" summary.
 *
 * The template only switches to "Matched to your card" when the event is
 * still on the default template (or `switchTemplate` forces it, for an
 * explicit "Build template from my card" click) — a host who already
 * picked a template keeps it, and gets the matching one as an option.
 */
export async function applyCardExtras(
  eventId: string,
  details: Pick<InvitationCardDetails, "whatsappNumber" | "theme">,
  currentTemplateSlug: string,
  options: { switchTemplate?: boolean; overwriteWhatsApp?: boolean; hasWhatsApp?: boolean } = {},
): Promise<string[]> {
  const filled: string[] = [];

  const number = details.whatsappNumber ? normaliseWhatsAppNumber(details.whatsappNumber) : null;
  if (number && (options.overwriteWhatsApp || !options.hasWhatsApp)) {
    await saveEventWhatsAppContact(eventId, number, null);
    filled.push("WhatsApp contact");
  }

  const theme = sanitizeCardTheme(details.theme);
  if (theme) {
    await saveEventCardTheme(eventId, theme);
    filled.push("Colours & fonts (Matched to your card template)");
    if (options.switchTemplate || currentTemplateSlug === DEFAULT_TEMPLATE_SLUG) {
      await updateEvent(eventId, { templateSlug: CARD_TEMPLATE_SLUG });
    }
  }

  return filled;
}
