import "server-only";

import { CARD_TEMPLATE_SLUG, sanitizeCardTheme } from "@/lib/card-theme";
import { DEFAULT_TEMPLATE_SLUG } from "@/lib/template-catalog";
import type { InvitationCardDetails } from "@/lib/ai-invitation-card-reader";
import { updateEvent } from "@/services/events";
import { normaliseWhatsAppNumber, saveEventCardTheme, saveEventWhatsAppContact } from "@/services/event-extras";
import { saveCardArtworkFromCard } from "@/services/card-artwork";

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
  details: Pick<InvitationCardDetails, "whatsappNumber" | "theme" | "artwork">,
  currentTemplateSlug: string,
  options: {
    switchTemplate?: boolean;
    overwriteWhatsApp?: boolean;
    hasWhatsApp?: boolean;
    /** The card image the details were read from — needed to crop out its illustration. */
    cardPath?: string;
    /** false = don't touch colours/template (e.g. "extract illustration only"). */
    applyTheme?: boolean;
  } = {},
): Promise<string[]> {
  const filled: string[] = [];

  if (details.artwork && options.cardPath) {
    try {
      if (await saveCardArtworkFromCard(eventId, options.cardPath, details.artwork)) filled.push("Card illustration");
    } catch (err) {
      console.error("applyCardExtras artwork failed:", err);
    }
  }

  const number = details.whatsappNumber ? normaliseWhatsAppNumber(details.whatsappNumber) : null;
  if (number && (options.overwriteWhatsApp || !options.hasWhatsApp)) {
    await saveEventWhatsAppContact(eventId, number, null);
    filled.push("WhatsApp contact");
  }

  const theme = options.applyTheme === false ? null : sanitizeCardTheme(details.theme);
  if (theme) {
    await saveEventCardTheme(eventId, theme);
    filled.push("Colours & fonts (Matched to your card template)");
    if (options.switchTemplate || currentTemplateSlug === DEFAULT_TEMPLATE_SLUG) {
      await updateEvent(eventId, { templateSlug: CARD_TEMPLATE_SLUG });
    }
  }

  return filled;
}
