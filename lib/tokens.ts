import { randomBytes } from "node:crypto";

/**
 * Alphabet deliberately excludes visually ambiguous characters
 * (0/O, 1/I/L) so tokens are easy to read aloud or retype, e.g. from a
 * printed card: "7FQ2KD91".
 */
const TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a cryptographically random, unique-enough invitation token.
 * Uniqueness against existing tokens is still enforced by the database
 * (`invitees.token` has a UNIQUE constraint) — callers creating invitees
 * in bulk should retry on conflict.
 */
export function generateInviteToken(length = 8): string {
  const bytes = randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  }
  return token;
}

/**
 * Generate a draft event's URL token — same "possession of the token is
 * the auth" pattern as generateInviteToken above, but far higher
 * entropy (192 bits vs ~40) since this one grants write access to build
 * out an entire event, not just update one guest's own RSVP. Lives only
 * in a URL (/start/[token]/...), never typed by hand, so readability
 * doesn't matter — see services/event-drafts.ts.
 */
export function generateDraftToken(): string {
  return randomBytes(24).toString("base64url");
}
