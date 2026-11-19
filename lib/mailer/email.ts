/** Email helpers for the Mailer — no imports, so tests/mailer.cjs can load this file directly. */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deliberately practical rather than RFC-complete: one "@", no spaces, a
// dot in the domain, a 2+ letter TLD, and no empty/dotted-edge labels.
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  if (value.length > 254) return false;
  if (!EMAIL_PATTERN.test(value)) return false;
  const local = value.slice(0, value.lastIndexOf("@"));
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

export function contactDisplayName(contact: { firstName: string; lastName: string; email: string }): string {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.email;
}
