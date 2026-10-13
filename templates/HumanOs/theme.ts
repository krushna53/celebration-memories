import type { TemplateTheme } from "@/lib/templates";

/**
 * HumanOS — private template matching HumanOS Learning and Consultancy
 * LLP's invitation card: deep navy type on warm cream, a mustard accent
 * (the dot in the "O"), clean geometric sans. Light highlight bands so
 * the hero and countdown stay cream like the card.
 */
export const humanOsTheme: TemplateTheme = {
  colors: {
    navy950: "#0f2440",
    navy900: "#16304f",
    navy800: "#1f3d60",
    navy700: "#2b4c72",
    navy600: "#3d5f86",
    gold100: "#f8eedb",
    gold200: "#f1ddb5",
    gold300: "#e8cb8f",
    gold400: "#ddb562",
    gold500: "#d4a03a",
    gold600: "#a87b22",
    ivory50: "#fbf8ef",
    ivory100: "#f5f0e2",
    ivory200: "#e9e2d0",
  },
  fontDisplayVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "minimal",
  highlightSurface: "light",
};
