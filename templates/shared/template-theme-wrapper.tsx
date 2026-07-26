import type { CSSProperties, ReactNode } from "react";

import type { TemplateTheme } from "@/lib/templates";

interface TemplateThemeWrapperProps {
  theme: TemplateTheme;
  children: ReactNode;
}

/**
 * Applies a template's palette + fonts by overriding the same CSS custom
 * properties app/globals.css declares in `@theme` (--color-gold-500,
 * --color-navy-950, --font-display, etc). Because every existing
 * component already styles itself with Tailwind utilities like
 * `text-gold-500` / `bg-navy-950` — which Tailwind v4 compiles to
 * `var(--color-gold-500)` — overriding those variables on this wrapper
 * re-themes the entire section stack for free. No section component
 * needs to know templates exist.
 */
export function TemplateThemeWrapper({ theme, children }: TemplateThemeWrapperProps) {
  const style = {
    "--color-navy-950": theme.colors.navy950,
    "--color-navy-900": theme.colors.navy900,
    "--color-navy-800": theme.colors.navy800,
    "--color-navy-700": theme.colors.navy700,
    "--color-navy-600": theme.colors.navy600,
    "--color-gold-100": theme.colors.gold100,
    "--color-gold-200": theme.colors.gold200,
    "--color-gold-300": theme.colors.gold300,
    "--color-gold-400": theme.colors.gold400,
    "--color-gold-500": theme.colors.gold500,
    "--color-gold-600": theme.colors.gold600,
    "--color-ivory-50": theme.colors.ivory50,
    "--color-ivory-100": theme.colors.ivory100,
    "--color-ivory-200": theme.colors.ivory200,
    "--font-display": theme.fontDisplayVar,
    "--font-sans": theme.fontSansVar,
  } as CSSProperties;

  return (
    <div style={style} data-template-animation={theme.animation}>
      {children}
    </div>
  );
}
