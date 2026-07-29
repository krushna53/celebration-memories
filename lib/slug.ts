/**
 * Converts free text into a URL-safe slug: lowercase, diacritics
 * stripped, non-alphanumeric runs collapsed to a single hyphen, leading/
 * trailing hyphens trimmed, capped at a sane length. Used both to
 * suggest a slug from an event's honoree/occasion (see
 * buildEventSlugSuggestion) and to validate whatever an admin types
 * into the URL Slug field (see isValidSlug).
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * A suggested slug from an event's occasion + honoree name, e.g.
 * "75th-birthday-celebration-mahesh-shah". Purely a suggestion for the
 * "Generate from Name" button in Event Settings / the wizard's Event
 * Basics step — never applied automatically, since a slug that's
 * already been shared (WhatsApp, printed invitations, etc.) breaking
 * silently would be far worse than an ugly one staying put.
 */
export function buildEventSlugSuggestion(
  honoreeName: string | null | undefined,
  occasion: string | null | undefined,
): string {
  const parts = [occasion, honoreeName].filter((p): p is string => Boolean(p && p.trim()));
  const slug = slugify(parts.join(" "));
  return slug || "my-event";
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** 3-80 chars, lowercase letters/numbers/hyphens only, no leading/trailing/double hyphens. */
export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 80 && SLUG_PATTERN.test(slug);
}
