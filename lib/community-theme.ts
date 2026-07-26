import type { TemplateTheme, TemplateSummary } from "@/lib/template-catalog";
import type { TemplateSubmissionRecord } from "@/types/template-submission";

const CATEGORY_LABELS: Record<TemplateSubmissionRecord["category"], string> = {
  general: "General",
  kids: "Kids",
  formal: "Formal",
  festive: "Festive",
  romantic: "Romantic",
};

/**
 * Derives the full 14-step palette every built-in TemplateTheme needs
 * from just 3 seed colors a contributor picks (dark/base, accent/gold,
 * light/ivory) — asking a non-technical designer for 14 individual hex
 * values would be an unreasonable submission form. Each "ramp" is a
 * simple linear interpolation toward white (for the dark base, producing
 * lighter steps) or toward black (for the accent, producing darker
 * steps), which is crude compared to a proper OKLCH-based scale but
 * looks reasonable for the CSS-custom-property overrides this theme
 * system already uses — see templates/shared/template-theme-wrapper.tsx.
 */

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Mixes `hex` toward `target` by `amount` (0 = hex, 1 = target). */
function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  ]);
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * Builds a complete TemplateTheme from a contributor's 3 seed colors +
 * font + animation choice. Used both for the live preview on the public
 * submission form and for actually rendering an approved community
 * template (see templates/CommunityTemplate/index.tsx).
 */
export function deriveThemeFromSubmission(submission: {
  baseDarkColor: string;
  baseAccentColor: string;
  baseLightColor: string;
  fontDisplay: string;
  animation: TemplateTheme["animation"];
}): TemplateTheme {
  const { baseDarkColor, baseAccentColor, baseLightColor, fontDisplay, animation } = submission;

  return {
    colors: {
      // Dark base ramp: 950 is the seed itself, each step lightens toward white.
      navy950: baseDarkColor,
      navy900: mix(baseDarkColor, WHITE, 0.08),
      navy800: mix(baseDarkColor, WHITE, 0.16),
      navy700: mix(baseDarkColor, WHITE, 0.26),
      navy600: mix(baseDarkColor, WHITE, 0.38),
      // Accent ramp: 100 is lightest (toward white), 600 is the seed mixed slightly toward black.
      gold100: mix(baseAccentColor, WHITE, 0.85),
      gold200: mix(baseAccentColor, WHITE, 0.68),
      gold300: mix(baseAccentColor, WHITE, 0.48),
      gold400: mix(baseAccentColor, WHITE, 0.24),
      gold500: baseAccentColor,
      gold600: mix(baseAccentColor, BLACK, 0.18),
      // Light/ivory ramp: seed is 50 (lightest), each step darkens slightly.
      ivory50: baseLightColor,
      ivory100: mix(baseLightColor, BLACK, 0.03),
      ivory200: mix(baseLightColor, BLACK, 0.07),
    },
    fontDisplayVar: `"${fontDisplay}", Georgia, serif`,
    fontSansVar: "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
    animation,
  };
}

/** Google Fonts stylesheet URL for a display font name, requested at weights every template's headings actually use. */
export function googleFontStylesheetUrl(fontFamily: string): string {
  const family = encodeURIComponent(fontFamily.trim());
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
}

/** Small SVG "invitation card" thumbnail, data-URI encoded — generated on the fly for community templates rather than requiring a designer to also produce artwork. Mirrors the hand-authored built-in thumbnails in /public/templates. */
export function communityThumbnailDataUri(submission: {
  name: string;
  baseDarkColor: string;
  baseAccentColor: string;
  baseLightColor: string;
  categoryLabel: string;
}): string {
  const { name, baseDarkColor, baseAccentColor, baseLightColor, categoryLabel } = submission;
  const escapedName = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="${baseDarkColor}"/>
  <rect y="220" width="400" height="80" fill="${baseLightColor}"/>
  <rect x="30" y="30" width="340" height="240" fill="none" stroke="${baseAccentColor}" stroke-width="1.5"/>
  <line x1="150" y1="140" x2="250" y2="140" stroke="${baseAccentColor}" stroke-width="1.5"/>
  <text x="200" y="130" font-family="Georgia, serif" font-size="14" fill="${baseAccentColor}" text-anchor="middle" letter-spacing="3">COMMUNITY</text>
  <text x="200" y="175" font-family="Georgia, serif" font-size="20" fill="${baseLightColor}" text-anchor="middle">${escapedName}</text>
  <text x="200" y="260" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="${baseDarkColor}" text-anchor="middle">${categoryLabel}</text>
</svg>`;
  // URI-encoded rather than base64 specifically so this has no Node
  // (Buffer) dependency — this function is called from both server code
  // (lib/templates.ts, the admin Templates page) and client code (the
  // live preview on the public submission form).
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Maps an approved submission to the same TemplateSummary shape every
 * built-in template uses, plus a `designer` field for credit display —
 * used by both lib/templates.ts (the live public renderer) and the admin
 * Templates picker page, so an approved community template shows up
 * alongside the 10 built-ins without either of those needing separate
 * logic for "is this a community template".
 */
export function communitySubmissionToTemplateSummary(
  submission: TemplateSubmissionRecord,
): TemplateSummary & { designer: { name: string; website: string | null } } {
  return {
    id: `community-${submission.id}`,
    slug: submission.slug!,
    name: submission.name,
    description: submission.description,
    category: submission.category,
    premium: false,
    thumbnail: communityThumbnailDataUri({
      name: submission.name,
      baseDarkColor: submission.baseDarkColor,
      baseAccentColor: submission.baseAccentColor,
      baseLightColor: submission.baseLightColor,
      categoryLabel: `Community · ${CATEGORY_LABELS[submission.category]}`,
    }),
    primaryColor: submission.baseAccentColor,
    secondaryColor: submission.baseDarkColor,
    fontFamily: submission.fontDisplay,
    designer: { name: submission.authorName, website: submission.authorWebsite },
  };
}

/** Deterministic, URL-safe slug for an approved submission — {kebab-name}-{short id suffix}, guaranteed unique via the id suffix even if two contributors pick the same template name. */
export function slugForApprovedSubmission(submission: Pick<TemplateSubmissionRecord, "id" | "name">): string {
  const base = submission.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = submission.id.slice(0, 8);
  return `${base || "community-template"}-${suffix}`;
}
