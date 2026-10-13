import type { TemplateTheme } from "@/lib/templates";

/**
 * HumanOS — private template matching HumanOS Learning and Consultancy
 * LLP's invitation cards: deep navy type on flat warm cream, the card's
 * teal green ("Drop a WhatsApp" pill) for actions and accents, clean
 * geometric sans. The card's mustard is only a small detail there, so it
 * isn't the accent here.
 *
 * gold100 (the lightest accent shade) is cream rather than pale teal on
 * purpose: light highlight bands (hero, countdown) are tinted from it, and
 * the card's background is cream, not mint.
 */
export const humanOsTheme: TemplateTheme = {
  colors: {
    navy950: "#12294a",
    navy900: "#18325a",
    navy800: "#21406b",
    navy700: "#2c4f7c",
    navy600: "#3e6290",
    gold100: "#f4efe2",
    gold200: "#cfe3dd",
    gold300: "#9fc7bb",
    gold400: "#5fa192",
    gold500: "#2e7d6b",
    gold600: "#23614f",
    ivory50: "#fbf8ef",
    ivory100: "#f5f0e2",
    ivory200: "#e9e2d0",
  },
  fontDisplayVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "minimal",
  highlightSurface: "light",
};
