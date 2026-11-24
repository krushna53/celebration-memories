import { mix } from "@/lib/color";
import type { TemplateTheme } from "@/lib/templates";

/**
 * The site's own sections shown inside Sacred Garden (the live RSVP form) in the couple's garden colours instead of
 * the platform's: accent → gold scale, text → navy scale (dark text), background → ivory (the paper).
 * f: the design form's colour and font fields (lib/invitation-form.js).
 */
export function gardenSiteTheme(f: { colorAccent: string; colorText: string; colorBackground: string; fontBody: string }): TemplateTheme {
  const accent = f.colorAccent, text = f.colorText, paper = f.colorBackground;
  return {
    colors: {
      navy950: mix(text, "#000000", 0.35),
      navy900: mix(text, "#000000", 0.25),
      navy800: mix(text, "#000000", 0.12),
      navy700: text,
      navy600: mix(text, paper, 0.15),
      gold100: mix(accent, paper, 0.85),
      gold200: mix(accent, paper, 0.65),
      gold300: mix(accent, paper, 0.4),
      gold400: mix(accent, paper, 0.2),
      gold500: accent,
      gold600: mix(accent, "#000000", 0.15),
      ivory50: paper,
      ivory100: mix(paper, "#ffffff", 0.4),
      ivory200: mix(paper, accent, 0.12),
    },
    fontDisplayVar: `"${f.fontBody}", Georgia, serif`,
    fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
    animation: "dreamy",
    highlightSurface: "light",
  };
}
