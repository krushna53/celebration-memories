import { validateCustomCss } from "@/lib/custom-css";

interface CustomCssBlockProps {
  css: string | null;
}

/**
 * Renders an event's client-safe Custom CSS (see lib/custom-css.ts and
 * Event Settings). Re-validates at render time as defense in depth —
 * even though features/admin/event-settings/actions.ts already validates
 * on save, this guards against the row ever being edited directly in the
 * database outside the app. Renders nothing if the CSS is missing or
 * fails validation, rather than risk rendering something unsafe.
 *
 * Rendered as part of the event page's own component tree (not injected
 * into <head> imperatively), so React naturally unmounts it when
 * navigating to a different event — it can never leak onto another
 * event's page or into the admin dashboard.
 */
export function CustomCssBlock({ css }: CustomCssBlockProps) {
  if (!css) return null;
  if (validateCustomCss(css)) return null;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
