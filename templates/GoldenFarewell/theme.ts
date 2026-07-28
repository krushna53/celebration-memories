import type { TemplateTheme } from "@/lib/templates";

/** Warm bronze & gold, dignified Playfair Display headings — retirement celebrations. */
export const goldenFarewellTheme: TemplateTheme = {
  colors: {
    navy950: "#1c130a",
    navy900: "#261a0e",
    navy800: "#332312",
    navy700: "#432f18",
    navy600: "#573f21",
    gold100: "#f8ecd2",
    gold200: "#efd9a6",
    gold300: "#e2c078",
    gold400: "#d3a955",
    gold500: "#c2903a",
    gold600: "#9c7128",
    ivory50: "#fffcf5",
    ivory100: "#faf1de",
    ivory200: "#f1e0bd",
  },
  fontDisplayVar: "var(--font-playfair), Georgia, serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "luxury",
};
