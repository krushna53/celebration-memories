import type { TemplateTheme } from "@/lib/templates";

/** Warm wine & amber, Playfair Display headings — festive but still polished, for birthdays that want to feel like a celebration without going full party mode. */
export const goldenConfettiTheme: TemplateTheme = {
  colors: {
    navy950: "#2b0f1a",
    navy900: "#3a1524",
    navy800: "#4a1c2e",
    navy700: "#5c2439",
    navy600: "#753049",
    gold100: "#fff3e0",
    gold200: "#ffe0b8",
    gold300: "#ffc98a",
    gold400: "#ffb35c",
    gold500: "#ff9a3c",
    gold600: "#e67e22",
    ivory50: "#fffaf3",
    ivory100: "#fff3e6",
    ivory200: "#ffe8d1",
  },
  fontDisplayVar: "var(--font-playfair), Georgia, serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "festive",
};
