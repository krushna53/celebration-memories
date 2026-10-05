import type { CSSProperties } from "react";

import { contrast, ensureContrast, isHexColor, isLight, mix } from "@/lib/color";
import type { TemplateTheme } from "@/lib/template-catalog";
import type { ThemeOverrides } from "@/types/event";

/**
 * Turns a template's palette + a host's ThemeOverrides into the CSS
 * custom properties TemplateThemeWrapper puts on the page.
 *
 * Two layers:
 *  - The page palette (--color-navy-*, --color-gold-*, --color-ivory-*):
 *    the template's colours, with the accent scale regenerated from the
 *    host's accent colour if they picked one.
 *  - The "highlight" palette (--feature-*): what the same tokens should
 *    mean inside `.surface-feature` — the Hero, Countdown, Timeline,
 *    Live Stream and Event Day bands, navbar, footer and mobile tab bar
 *    (see app/globals.css). Those components were written for a dark
 *    band (bg-navy-*, text-ivory-*, text-gold-300). For a "light"
 *    highlight the roles swap inside that scope — navy becomes the light
 *    background, ivory becomes the dark text — so every one of those
 *    components re-themes without knowing templates exist, the same
 *    trick the wrapper already uses for whole palettes. Accent text in
 *    either mode is contrast-checked against the band's background, which
 *    is what fixes e.g. Minimal White's near-black accent disappearing on
 *    a near-black band.
 */

const PALETTE_KEYS = [
  ["navy950", "navy-950"],
  ["navy900", "navy-900"],
  ["navy800", "navy-800"],
  ["navy700", "navy-700"],
  ["navy600", "navy-600"],
  ["gold100", "gold-100"],
  ["gold200", "gold-200"],
  ["gold300", "gold-300"],
  ["gold400", "gold-400"],
  ["gold500", "gold-500"],
  ["gold600", "gold-600"],
  ["ivory50", "ivory-50"],
  ["ivory100", "ivory-100"],
  ["ivory200", "ivory-200"],
] as const;

type Palette = TemplateTheme["colors"];

/** Drops anything that isn't a valid value — overrides arrive from a form and are stored as jsonb. */
export function sanitizeThemeOverrides(input: ThemeOverrides | null | undefined): ThemeOverrides | null {
  if (!input) return null;
  const out: ThemeOverrides = {};
  if (isHexColor(input.accentColor)) out.accentColor = input.accentColor.toLowerCase();
  if (input.highlightStyle === "light" || input.highlightStyle === "dark") out.highlightStyle = input.highlightStyle;
  if (isHexColor(input.highlightColor)) out.highlightColor = input.highlightColor.toLowerCase();
  return Object.keys(out).length > 0 ? out : null;
}

function accentScale(accent: string): Pick<Palette, "gold100" | "gold200" | "gold300" | "gold400" | "gold500" | "gold600"> {
  return {
    gold100: mix(accent, "#ffffff", 0.85),
    gold200: mix(accent, "#ffffff", 0.65),
    gold300: mix(accent, "#ffffff", 0.42),
    gold400: mix(accent, "#ffffff", 0.2),
    gold500: accent,
    gold600: mix(accent, "#000000", 0.2),
  };
}

export function resolveHighlightMode(theme: TemplateTheme, overrides: ThemeOverrides | null | undefined): "light" | "dark" {
  if (overrides?.highlightColor && isHexColor(overrides.highlightColor)) {
    return isLight(overrides.highlightColor) ? "light" : "dark";
  }
  if (overrides?.highlightStyle === "light" || overrides?.highlightStyle === "dark") return overrides.highlightStyle;
  return theme.highlightSurface ?? "dark";
}

function highlightPalette(base: Palette, mode: "light" | "dark", custom: string | null): Palette {
  if (mode === "dark") {
    const bg950 = custom ?? base.navy950;
    const bg900 = custom ? mix(custom, "#ffffff", 0.05) : base.navy900;
    const bg800 = custom ? mix(custom, "#ffffff", 0.12) : base.navy800;
    return {
      ...base,
      navy950: bg950,
      navy900: bg900,
      navy800: bg800,
      ivory50: ensureContrast(base.ivory50, bg900, 7),
      ivory100: ensureContrast(base.ivory100, bg900, 4.5),
      ivory200: ensureContrast(base.ivory200, bg900, 4.5),
      gold200: ensureContrast(base.gold200, bg900, 4.5),
      gold300: ensureContrast(base.gold300, bg900, 4.5),
      gold400: ensureContrast(base.gold400, bg900, 3),
    };
  }

  // Light band: a soft wash of the accent's lightest shade over the page background, unless the host picked an exact colour.
  const bg = custom ?? mix(base.ivory50, base.gold100, 0.6);
  const text = ensureContrast(base.navy950, bg, 7);
  return {
    ...base,
    navy950: bg,
    navy900: bg,
    navy800: mix(bg, base.navy900, 0.08),
    ivory50: text,
    ivory100: ensureContrast(base.navy800, bg, 4.5),
    ivory200: ensureContrast(base.navy700, bg, 4.5),
    gold200: ensureContrast(base.gold600, bg, 4.5),
    gold300: ensureContrast(base.gold600, bg, 4.5),
    gold400: ensureContrast(base.gold500, bg, 3),
  };
}

function onAccent(p: Palette): string {
  return contrast(p.navy950, p.gold500) >= contrast(p.ivory50, p.gold500) ? p.navy950 : p.ivory50;
}

/** The final page palette (template + host overrides) — also used by client previews. */
export function resolvePalette(theme: TemplateTheme, overrides: ThemeOverrides | null | undefined): Palette {
  const accent = overrides?.accentColor && isHexColor(overrides.accentColor) ? overrides.accentColor : null;
  return accent ? { ...theme.colors, ...accentScale(accent) } : theme.colors;
}

export function buildThemeStyle(theme: TemplateTheme, overrides?: ThemeOverrides | null): CSSProperties {
  const base = resolvePalette(theme, overrides);
  const mode = resolveHighlightMode(theme, overrides);
  const custom = overrides?.highlightColor && isHexColor(overrides.highlightColor) ? overrides.highlightColor : null;
  const feature = highlightPalette(base, mode, custom);

  const style: Record<string, string> = {
    "--font-display": theme.fontDisplayVar,
    "--font-sans": theme.fontSansVar,
  };
  for (const [key, token] of PALETTE_KEYS) {
    style[`--color-${token}`] = base[key];
    style[`--feature-${token}`] = feature[key];
  }
  // Text on accent-filled buttons: whichever of the palette's dark/light ends reads better on the accent.
  style["--primary-foreground"] = onAccent(base);
  style["--feature-on-accent"] = onAccent(feature);
  return style as CSSProperties;
}
