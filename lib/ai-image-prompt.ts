import type { EventRecord } from "@/types/event";
import type { TemplateSummary } from "@/lib/templates";

/**
 * Builds the default AI Image prompt for the "Invitation Card" tool —
 * shared by the admin dashboard (app/admin/(dashboard)/ai-image/page.tsx)
 * and the self-serve wizard (app/start/[token]/ai-image/page.tsx) so the
 * two never drift out of sync.
 *
 * Used to explicitly instruct "no readable text in the image" — that
 * was a hedge against older diffusion models (DALL-E era) rendering
 * garbled/gibberish text, which looked worse than no text at all. This
 * app now generates via gpt-image-2 (see lib/ai-image.ts), which OpenAI
 * specifically improved at rendering legible text, so the hedge is
 * counterproductive: hosts want their actual event details ON the
 * card, not a text-free background graphic. The exact wording each
 * field should render is spelled out in quotes — OpenAI's own guidance
 * for gpt-image models is that quoting exact strings meaningfully
 * improves how accurately requested text gets rendered, versus
 * describing the text only in prose.
 */
export function buildInvitationCardPrompt(
  event: Pick<EventRecord, "honoreeName" | "occasion" | "eventTitle" | "hostedBy" | "startAt" | "venueName">,
  template: Pick<TemplateSummary, "name" | "primaryColor" | "secondaryColor">,
): string {
  const dateLabel = new Date(event.startAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const occasionLabel = event.occasion || event.eventTitle;
  const hostLabel = event.hostedBy || "the host";

  return [
    `An elegant, printable invitation card design for ${event.honoreeName}'s ${occasionLabel}, hosted by ${hostLabel}.`,
    `Color palette inspired by ${template.name}: warm tones around ${template.primaryColor} and ${template.secondaryColor}.`,
    `Render the following text clearly and legibly on the card, in elegant typography that fits the design (this is the most important part — the text must be accurate and easy to read, not decorative squiggles):`,
    `"${event.honoreeName}" as the main heading.`,
    `"${occasionLabel}" as a subheading.`,
    `"${dateLabel}"${event.venueName ? ` and "${event.venueName}"` : ""} as event details.`,
    `"Hosted by ${hostLabel}" in smaller text.`,
    "Leave enough clear space around each line of text so nothing overlaps decorative elements. High-quality, elegant, premium invitation card style.",
  ].join(" ");
}
