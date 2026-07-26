import { Playfair_Display, Poppins } from "next/font/google";

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
