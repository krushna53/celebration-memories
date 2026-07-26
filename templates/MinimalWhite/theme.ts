import type { TemplateTheme } from "@/lib/templates";

/** Monochrome ink-on-white, single-hue accent — corporate & modern formal events. */
export const minimalWhiteTheme: TemplateTheme = {
  colors: {
    navy950: "#1a1a1a",
    navy900: "#242424",
    navy800: "#2e2e2e",
    navy700: "#4d4d4d",
    navy600: "#6b6b6b",
    gold100: "#f2f2f2",
    gold200: "#e0e0e0",
    gold300: "#c2c2c2",
    gold400: "#8f8f8f",
    gold500: "#1a1a1a",
    gold600: "#000000",
    ivory50: "#ffffff",
    ivory100: "#f7f7f7",
    ivory200: "#ececec",
  },
  fontDisplayVar: "var(--font-inter), \"Helvetica Neue\", Arial, sans-serif",
  fontSansVar: "var(--font-inter), \"Helvetica Neue\", Arial, sans-serif",
  animation: "minimal",
};
