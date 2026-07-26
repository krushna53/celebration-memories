import type { TemplateTheme } from "@/lib/templates";

/** Sepia tones and antique brass, EB Garamond headings, slow soft motion — a nostalgic, cherished-memories keepsake feel. */
export const vintageKeepsakeTheme: TemplateTheme = {
  colors: {
    navy950: "#2e1f14",
    navy900: "#3d2a1c",
    navy800: "#4d3624",
    navy700: "#5f452f",
    navy600: "#77593d",
    gold100: "#faf3e4",
    gold200: "#f0e0bd",
    gold300: "#e3c98e",
    gold400: "#d4ad5f",
    gold500: "#c08a3e",
    gold600: "#996b2c",
    ivory50: "#fffdf8",
    ivory100: "#faf4e8",
    ivory200: "#f0e5cd",
  },
  fontDisplayVar: "var(--font-eb-garamond), Georgia, serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "dreamy",
};
