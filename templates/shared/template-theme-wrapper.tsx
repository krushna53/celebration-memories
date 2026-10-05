import type { ReactNode } from "react";

import type { TemplateTheme } from "@/lib/templates";
import { buildThemeStyle } from "@/lib/template-theme-vars";
import type { ThemeOverrides } from "@/types/event";
import { TemplateAnimationProvider } from "@/templates/shared/template-animation-context";

interface TemplateThemeWrapperProps {
  theme: TemplateTheme;
  /** The event's own colour tweaks (events.theme_overrides), layered on top of `theme`. */
  overrides?: ThemeOverrides | null;
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
 * needs to know templates exist. The variables themselves (including
 * the `--feature-*` set for highlight bands) come from
 * lib/template-theme-vars.ts.
 */
export function TemplateThemeWrapper({ theme, overrides, children }: TemplateThemeWrapperProps) {
  const style = buildThemeStyle(theme, overrides);

  return (
    <TemplateAnimationProvider value={theme.animation}>
      <div style={style} data-template-animation={theme.animation}>
        {children}
      </div>
    </TemplateAnimationProvider>
  );
}
