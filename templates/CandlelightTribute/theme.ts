import type { TemplateTheme } from "@/lib/templates";

/** Warm espresso brown & soft rose-gold, classic Playfair Display serif — a candlelit, glowing take on a memorial tribute (distinct from Golden Farewell's brighter yellow-gold retirement palette). */
export const candlelightTributeTheme: TemplateTheme = {
  colors: {
    navy950: "#1f1712",
    navy900: "#2b201a",
    navy800: "#392b22",
    navy700: "#4a382c",
    navy600: "#5f4838",
    gold100: "#f6e9e3",
    gold200: "#ecd0c3",
    gold300: "#ddb29d",
    gold400: "#cc9377",
    gold500: "#b3765a",
    gold600: "#8f5c45",
    ivory50: "#fdf9f2",
    ivory100: "#f8f0e0",
    ivory200: "#efe1c4",
  },
  fontDisplayVar: "var(--font-playfair), Georgia, serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "minimal",
};
