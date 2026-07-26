import {
  Playfair_Display,
  Poppins,
  Dancing_Script,
  Baloo_2,
  Bebas_Neue,
  Inter,
  Righteous,
  EB_Garamond,
} from "next/font/google";

/**
 * Display serif used for headings and honoree name treatments.
 */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

/**
 * Body sans-serif used for all running text and UI copy.
 */
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

/**
 * The fonts below are only used by specific templates (see
 * /templates/*\/theme.ts) — they're loaded once here at the module
 * level (a next/font/google requirement) and every template's `.variable`
 * class gets applied on <html> in app/layout.tsx so any template can
 * reference them via CSS var, without loading fonts it doesn't use on
 * pages that don't need them (next/font subsets by usage automatically).
 */

/** Romantic script display face — used by the Floral Pastel template. */
export const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-dancing-script",
  display: "swap",
});

/** Rounded, friendly display face — used by the Kids Cartoon template. */
export const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo2",
  display: "swap",
});

/** Bold condensed display face — used by the Neon Party template. */
export const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
  display: "swap",
});

/** Clean grotesk — used by the Minimal White template (heading + body). */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/** Bold, rounded groovy display face — used by the Retro Disco template. */
export const righteous = Righteous({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-righteous",
  display: "swap",
});

/** Old-style antique serif — used by the Vintage Keepsake template. */
export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-eb-garamond",
  display: "swap",
});
