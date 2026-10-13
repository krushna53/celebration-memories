import { ensureContrast, isHexColor, isLight, mix } from "@/lib/color";
import type { TemplateTheme } from "@/lib/template-catalog";

/**
 * "Matched to your card" — a template built from the colours and type
 * style read off the host's invitation card (lib/ai-invitation-card-reader.ts
 * → events.card_theme). Client-safe and pure: the stored jsonb is
 * re-validated here every time it's used.
 */
export type CardFontStyle = "serif" | "sans" | "rounded" | "script";

export interface CardTheme {
  /** Main page background, e.g. the card's cream or white. */
  background: string;
  /** Main heading/text colour, e.g. a deep navy. */
  text: string;
  /** The standout brand colour, e.g. a mustard dot or a gold rule. */
  accent: string;
  font: CardFontStyle;
}

const FONT_STYLES: readonly CardFontStyle[] = ["serif", "sans", "rounded", "script"];

export function sanitizeCardTheme(input: unknown): CardTheme | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!isHexColor(raw.background) || !isHexColor(raw.text) || !isHexColor(raw.accent)) return null;
  const font = FONT_STYLES.includes(raw.font as CardFontStyle) ? (raw.font as CardFontStyle) : "sans";
  return { background: raw.background.toLowerCase(), text: raw.text.toLowerCase(), accent: raw.accent.toLowerCase(), font };
}

const FONTS: Record<CardFontStyle, { display: string; sans: string }> = {
  serif: { display: "var(--font-playfair), Georgia, serif", sans: "var(--font-poppins), Arial, sans-serif" },
  sans: { display: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif", sans: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif" },
  rounded: { display: "var(--font-quicksand), \"Helvetica Neue\", Arial, sans-serif", sans: "var(--font-quicksand), \"Helvetica Neue\", Arial, sans-serif" },
  script: { display: "var(--font-dancing-script), cursive", sans: "var(--font-poppins), Arial, sans-serif" },
};

/**
 * Maps the three card colours onto the platform's palette tokens:
 * navy-* = the card's text colour (dark end), gold-* = its accent,
 * ivory-* = its background. A dark card (white text on navy) is handled
 * by making the text colour the light end and keeping contrast checked,
 * so every shared section still reads.
 */
export function buildCardTemplateTheme(card: CardTheme): TemplateTheme {
  const lightPage = isLight(card.background);
  // Page background must be light for the shared sections (they're written for a light page with dark text).
  const page = lightPage ? card.background : mix(card.text, "#ffffff", 0.92);
  const ink = ensureContrast(lightPage ? card.text : card.background, page, 7);
  const accent = ensureContrast(card.accent, page, 2.5);
  return {
    colors: {
      navy950: ink,
      navy900: mix(ink, page, 0.08),
      navy800: mix(ink, page, 0.16),
      navy700: mix(ink, page, 0.26),
      navy600: mix(ink, page, 0.38),
      gold100: mix(accent, "#ffffff", 0.85),
      gold200: mix(accent, "#ffffff", 0.65),
      gold300: mix(accent, "#ffffff", 0.42),
      gold400: mix(accent, "#ffffff", 0.2),
      gold500: accent,
      gold600: mix(accent, "#000000", 0.2),
      ivory50: page,
      ivory100: mix(page, ink, 0.04),
      ivory200: mix(page, ink, 0.1),
    },
    fontDisplayVar: FONTS[card.font].display,
    fontSansVar: FONTS[card.font].sans,
    animation: "minimal",
    // A light card keeps light hero/countdown bands; a dark card keeps them dark like the card itself.
    highlightSurface: lightPage ? "light" : "dark",
  };
}

export const CARD_TEMPLATE_SLUG = "card-match";
