import localFont from "next/font/local";

// Font files live in lib/font-files (Latin subset from Google Fonts) so builds never
// download from Google; Netlify builds kept failing on those downloads.

/**
 * Display serif used for headings and honoree name treatments.
 */
export const playfair = localFont({
  src: [
    { path: "./font-files/playfair-display-400.woff2", weight: "400" },
    { path: "./font-files/playfair-display-500.woff2", weight: "500" },
    { path: "./font-files/playfair-display-600.woff2", weight: "600" },
    { path: "./font-files/playfair-display-700.woff2", weight: "700" },
  ],
  variable: "--font-playfair",
  display: "swap",
});

/**
 * Body sans-serif used for all running text and UI copy.
 */
export const poppins = localFont({
  src: [
    { path: "./font-files/poppins-300.woff2", weight: "300" },
    { path: "./font-files/poppins-400.woff2", weight: "400" },
    { path: "./font-files/poppins-500.woff2", weight: "500" },
    { path: "./font-files/poppins-600.woff2", weight: "600" },
    { path: "./font-files/poppins-700.woff2", weight: "700" },
  ],
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
export const dancingScript = localFont({
  src: [
    { path: "./font-files/dancing-script-500.woff2", weight: "500" },
    { path: "./font-files/dancing-script-600.woff2", weight: "600" },
    { path: "./font-files/dancing-script-700.woff2", weight: "700" },
  ],
  variable: "--font-dancing-script",
  display: "swap",
});

/** Rounded, friendly display face — used by the Kids Cartoon template. */
export const baloo2 = localFont({
  src: [
    { path: "./font-files/baloo-2-500.woff2", weight: "500" },
    { path: "./font-files/baloo-2-600.woff2", weight: "600" },
    { path: "./font-files/baloo-2-700.woff2", weight: "700" },
    { path: "./font-files/baloo-2-800.woff2", weight: "800" },
  ],
  variable: "--font-baloo2",
  display: "swap",
});

/** Bold condensed display face — used by the Neon Party template. */
export const bebasNeue = localFont({
  src: [
    { path: "./font-files/bebas-neue-400.woff2", weight: "400" },
  ],
  variable: "--font-bebas-neue",
  display: "swap",
});

/** Clean grotesk — used by the Minimal White template (heading + body). */
export const inter = localFont({
  src: [
    { path: "./font-files/inter-300.woff2", weight: "300" },
    { path: "./font-files/inter-400.woff2", weight: "400" },
    { path: "./font-files/inter-500.woff2", weight: "500" },
    { path: "./font-files/inter-600.woff2", weight: "600" },
    { path: "./font-files/inter-700.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

/** Bold, rounded groovy display face — used by the Retro Disco template. */
export const righteous = localFont({
  src: [
    { path: "./font-files/righteous-400.woff2", weight: "400" },
  ],
  variable: "--font-righteous",
  display: "swap",
});

/** Old-style antique serif — used by the Vintage Keepsake template. */
export const ebGaramond = localFont({
  src: [
    { path: "./font-files/eb-garamond-400.woff2", weight: "400" },
    { path: "./font-files/eb-garamond-500.woff2", weight: "500" },
    { path: "./font-files/eb-garamond-600.woff2", weight: "600" },
    { path: "./font-files/eb-garamond-700.woff2", weight: "700" },
  ],
  variable: "--font-eb-garamond",
  display: "swap",
});

/** Elegant tall-waisted serif — used by the Ivory Blush wedding template. */
export const cormorantGaramond = localFont({
  src: [
    { path: "./font-files/cormorant-garamond-400.woff2", weight: "400" },
    { path: "./font-files/cormorant-garamond-500.woff2", weight: "500" },
    { path: "./font-files/cormorant-garamond-600.woff2", weight: "600" },
    { path: "./font-files/cormorant-garamond-700.woff2", weight: "700" },
  ],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

/** Soft rounded display face — used by the Little Blessings baby shower template. */
export const quicksand = localFont({
  src: [
    { path: "./font-files/quicksand-400.woff2", weight: "400" },
    { path: "./font-files/quicksand-500.woff2", weight: "500" },
    { path: "./font-files/quicksand-600.woff2", weight: "600" },
    { path: "./font-files/quicksand-700.woff2", weight: "700" },
  ],
  variable: "--font-quicksand",
  display: "swap",
});

/** Clean sans used by the wedding-websites create form. */
export const dmSans = localFont({
  src: [
    { path: "./font-files/dm-sans-400.woff2", weight: "400" },
    { path: "./font-files/dm-sans-500.woff2", weight: "500" },
    { path: "./font-files/dm-sans-600.woff2", weight: "600" },
    { path: "./font-files/dm-sans-700.woff2", weight: "700" },
  ],
  display: "swap",
});
