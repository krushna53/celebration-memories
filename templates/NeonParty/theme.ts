import type { TemplateTheme } from "@/lib/templates";

/** Near-black base, electric pink & cyan accent, bold condensed display face — milestone parties. */
export const neonPartyTheme: TemplateTheme = {
  colors: {
    navy950: "#0d0d1a",
    navy900: "#14142b",
    navy800: "#1c1c3a",
    navy700: "#33335c",
    navy600: "#4a4a7a",
    gold100: "#ffe0f5",
    gold200: "#ffc2ea",
    gold300: "#ff8fd6",
    gold400: "#ff5fc2",
    gold500: "#ff2fb8",
    gold600: "#d1189a",
    ivory50: "#fdfbff",
    ivory100: "#f7f0ff",
    ivory200: "#ecdcff",
  },
  fontDisplayVar: "var(--font-bebas-neue), Impact, sans-serif",
  fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  animation: "energetic",
};
