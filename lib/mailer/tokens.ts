import type { MailerContact, MailerEvent } from "@/types/mailer";

/**
 * Personalisation tokens, written as {{token}} in a subject, preheader,
 * body or button label. Unknown tokens are left as typed so a typo is
 * visible in the preview instead of silently disappearing.
 */
export const MAILER_TOKENS = [
  { token: "first_name", label: "First name", example: "Priya" },
  { token: "last_name", label: "Last name", example: "Sharma" },
  { token: "full_name", label: "Full name", example: "Priya Sharma" },
  { token: "email", label: "Email", example: "priya@acme.example" },
  { token: "company", label: "Company", example: "Acme Industries" },
  { token: "event_name", label: "Event name", example: "Annual Day 2026" },
  { token: "event_date", label: "Event date", example: "12 December 2026" },
  { token: "event_venue", label: "Event venue", example: "Taj Lands End, Mumbai" },
  { token: "sender_name", label: "Sender name", example: "Team Acme" },
] as const;

export type MailerToken = (typeof MAILER_TOKENS)[number]["token"];
export type TokenValues = Record<MailerToken, string>;

const TOKEN_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

/** Formats a YYYY-MM-DD calendar date without any timezone shift (it's a date, not an instant). */
export function formatMailerDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function tokenValuesFor(
  contact: Pick<MailerContact, "firstName" | "lastName" | "email" | "company"> | null,
  event: MailerEvent | null,
  senderName: string,
): TokenValues {
  const firstName = contact?.firstName.trim() ?? "";
  const lastName = contact?.lastName.trim() ?? "";
  return {
    // A sensible greeting even when a contact has no name on file ("Dear there" reads badly, "Dear friend" doesn't).
    first_name: firstName || "friend",
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim() || "friend",
    email: contact?.email ?? "",
    company: contact?.company.trim() ?? "",
    event_name: event?.name ?? "",
    event_date: event ? formatMailerDate(event.date) : "",
    event_venue: event?.venue ?? "",
    sender_name: senderName.trim(),
  };
}

export function sampleTokenValues(): TokenValues {
  return Object.fromEntries(MAILER_TOKENS.map((t) => [t.token, t.example])) as TokenValues;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replaces {{tokens}} in plain text. */
export function renderTokens(text: string, values: TokenValues): string {
  return text.replace(TOKEN_PATTERN, (whole, name: string) => {
    const key = name.toLowerCase() as MailerToken;
    return key in values ? values[key] : whole;
  });
}

/** Tokens used in `text` that aren't known — shown as a warning in the editor. */
export function unknownTokens(text: string): string[] {
  const known = new Set<string>(MAILER_TOKENS.map((t) => t.token));
  const found = new Set<string>();
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const name = match[1]!.toLowerCase();
    if (!known.has(name)) found.add(name);
  }
  return [...found];
}
