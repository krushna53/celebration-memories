import type { TemplateTheme } from "@/lib/templates";

/** Matches app/globals.css exactly — the platform's original look. */
export const royalGoldTheme: TemplateTheme = {
  colors: {
    navy950: "#060d1a",
    navy900: "#0b1626",
    navy800: "#101f36",
    navy700: "#172a47",
    navy600: "#21395e",
    gold100: "#f8ecc6",
    gold200: "#f0dd9c",
    gold300: "#e6c874",
    gold400: "#d9b158",
    gold500: "#c9a227",
    gold600: "#a9861e",
    ivory50: "#fffdf7",
    ivory100: "#fbf6ea",
    ivory200: "#f5edd8",
  },
  fontDisplayVar: "var(--font-playfair), Georgia, serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "luxury",
};
