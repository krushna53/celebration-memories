import type { TemplateTheme } from "@/lib/templates";

/**
 * Warm white, dark navy and a deep-teal accent, with restrained gold kept
 * for decoration only (see white-coat-reunion.css) — a calm, readable look
 * for medical-college / alumni batch reunions with many senior guests.
 * The "gold" scale is the teal accent: it drives buttons, eyebrows and
 * links, and teal on white passes WCAG AA where a gold accent wouldn't.
 */
export const whiteCoatReunionTheme: TemplateTheme = {
  colors: {
    navy950: "#17263c",
    navy900: "#1f3049",
    navy800: "#2a3d57",
    navy700: "#526070",
    navy600: "#6b7785",
    gold100: "#e3f0ee",
    gold200: "#bfdcd7",
    gold300: "#7fb5ac",
    gold400: "#3f8a80",
    gold500: "#17665e",
    gold600: "#10504a",
    ivory50: "#faf8f4",
    ivory100: "#f3efe7",
    ivory200: "#e8e2d6",
  },
  fontDisplayVar: "var(--font-playfair), Georgia, serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "gentle",
  highlightSurface: "light",
};
