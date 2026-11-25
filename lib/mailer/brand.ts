import type { MailerBrand, MailerBrandInput, MailerData } from "@/types/mailer";

/**
 * Brand Settings rules, shared by mock mode (LocalStorage), live mode
 * (the same repository code running on the Firestore document) and the
 * form itself, so validation is identical everywhere.
 */

export const DEFAULT_PRIMARY_COLOR = "#FF6B57";
export const DEFAULT_SECONDARY_COLOR = "#1E2A4A";

/** What the person may pick. The stored logo is always a PNG made from it in the browser. */
export const LOGO_ACCEPT = ["image/png", "image/jpeg", "image/svg+xml"] as const;
export const LOGO_ACCEPT_ATTR = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** The converted PNG fits inside this box (twice the size it's shown at in emails, for sharp screens). */
export const LOGO_MAX_WIDTH = 600;
export const LOGO_MAX_HEIGHT = 240;
/** Mock mode keeps the logo inline in LocalStorage — this keeps it from crowding out the rest. */
export const INLINE_LOGO_MAX_CHARS = 700_000;

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
const INLINE_PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function defaultBrandInput(): MailerBrandInput {
  return { logoUrl: null, primaryColor: DEFAULT_PRIMARY_COLOR, secondaryColor: DEFAULT_SECONDARY_COLOR };
}

/** "#2563eb", "2563EB" or "#26e" → "#2563EB"; anything else → null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = HEX_RE.exec(value.trim());
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return `#${hex.toUpperCase()}`;
}

export function isInlineLogo(url: string): boolean {
  return INLINE_PNG_RE.test(url);
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export type BrandCheck = { ok: true; value: MailerBrandInput } | { ok: false; error: string };

/**
 * Validates a Brand Settings save. The logo must be the PNG the form made
 * (inline) or an https URL; live mode additionally checks the URL is this
 * company's own upload (services/mailer/brand-logo.ts).
 */
export function cleanBrandInput(input: unknown): BrandCheck {
  const raw = (input ?? {}) as Partial<Record<keyof MailerBrandInput, unknown>>;
  const primaryColor = normalizeHex(raw.primaryColor);
  if (!primaryColor) return { ok: false, error: "Primary color must be a HEX code like #FF6B57." };
  const secondaryColor = normalizeHex(raw.secondaryColor);
  if (!secondaryColor) return { ok: false, error: "Secondary color must be a HEX code like #1E2A4A." };

  let logoUrl: string | null = null;
  if (raw.logoUrl !== null && raw.logoUrl !== undefined && raw.logoUrl !== "") {
    if (typeof raw.logoUrl !== "string") return { ok: false, error: "That logo couldn't be saved — upload it again." };
    const url = raw.logoUrl.trim();
    if (url.startsWith("data:")) {
      if (!isInlineLogo(url)) return { ok: false, error: "That logo couldn't be saved — upload it again." };
      if (url.length > INLINE_LOGO_MAX_CHARS) return { ok: false, error: "That logo is too large to keep in this browser — try a smaller image." };
    } else if (!isHttpsUrl(url) || url.length > 1000) {
      return { ok: false, error: "That logo couldn't be saved — upload it again." };
    }
    logoUrl = url;
  }
  return { ok: true, value: { logoUrl, primaryColor, secondaryColor } };
}

/** The saved brand, or null when Brand Settings was never saved (emails keep their per-kind look). */
export function brandOf(data: Pick<MailerData, "brand"> | null | undefined): MailerBrand | null {
  const brand = data?.brand;
  if (!brand) return null;
  const clean = cleanBrandInput(brand);
  return clean.ok ? { ...clean.value, updatedAt: brand.updatedAt } : null;
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function readableTextOn(hex: string): "#FFFFFF" | "#111111" {
  const n = normalizeHex(hex) ?? DEFAULT_PRIMARY_COLOR;
  const channel = (i: number) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Contrast with white vs. with near-black; pick the larger.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.06 ? "#FFFFFF" : "#111111";
}
