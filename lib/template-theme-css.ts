import type { CSSProperties } from "react";

/**
 * Lightweight per-template theming for pages that don't render a full
 * bespoke template component (e.g. app/events/[slug]/rsvp) — rather than
 * rebuilding the page per template the way /events/[slug] itself does,
 * this just overrides the CSS custom properties Tailwind's `gold-*`
 * classes and the `font-display` utility already resolve to (see
 * app/globals.css's `@theme` block). Every existing `text-gold-500`,
 * `border-gold-600`, `font-display`, etc. class already used on the page
 * (and in any client component rendered inside it, like
 * PublicRsvpForm) picks up the event's chosen template automatically —
 * no need to thread a theme prop through every component or rewrite
 * their classNames.
 *
 * Deliberately does NOT touch the `navy-*` scale — that's used for body
 * text/neutral surfaces across every template for readability, not the
 * template's brand accent, so leaving it alone keeps contrast safe
 * regardless of how light or dark a given template's primaryColor is.
 */

/** Maps each template's plain-English fontFamily name (lib/template-catalog.ts) to the matching next/font CSS variable (lib/fonts.ts), which is already loaded site-wide via app/layout.tsx. */
const FONT_VAR_BY_NAME: Record<string, string> = {
  "Playfair Display": "var(--font-playfair)",
  Poppins: "var(--font-poppins)",
  "Dancing Script": "var(--font-dancing-script)",
  "Baloo 2": "var(--font-baloo2)",
  "Bebas Neue": "var(--font-bebas-neue)",
  Inter: "var(--font-inter)",
  Righteous: "var(--font-righteous)",
  "EB Garamond": "var(--font-eb-garamond)",
  "Cormorant Garamond": "var(--font-cormorant-garamond)",
  Quicksand: "var(--font-quicksand)",
};

/**
 * Builds the inline `style` object that themes a page section to a given
 * template's accent color and heading font — spread this onto a wrapping
 * element and every descendant's `gold-*`/`font-display` Tailwind classes
 * follow automatically via normal CSS custom property inheritance.
 */
export function templateAccentStyle(template: { primaryColor: string; fontFamily: string }): CSSProperties {
  const fontVar = FONT_VAR_BY_NAME[template.fontFamily] ?? "var(--font-playfair)";
  const primary = template.primaryColor;

  return {
    "--font-display": `${fontVar}, "Georgia", serif`,
    "--color-gold-100": `color-mix(in srgb, ${primary} 25%, white)`,
    "--color-gold-200": `color-mix(in srgb, ${primary} 45%, white)`,
    "--color-gold-300": `color-mix(in srgb, ${primary} 65%, white)`,
    "--color-gold-400": `color-mix(in srgb, ${primary} 85%, white)`,
    "--color-gold-500": primary,
    "--color-gold-600": `color-mix(in srgb, ${primary} 85%, black)`,
  } as CSSProperties;
}
