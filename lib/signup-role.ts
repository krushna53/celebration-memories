/**
 * The "Role" chosen on the sign-up page (app/signup). Stored on the
 * Supabase Auth user as user_metadata.signup_role — no table of its own.
 *
 *   event_owner    → personal events: the self-serve event wizard (/start)
 *   business_owner → the Email Campaign (Event Mailer) dashboard (/admin/mailer)
 *
 * Pure rules, shared by the form, the server and tests/signup-role.cjs.
 */

export type SignupRole = "event_owner" | "business_owner";

export const SIGNUP_ROLES: readonly { role: SignupRole; label: string; description: string }[] = [
  { role: "event_owner", label: "Event Owner", description: "Birthdays, anniversaries, family celebrations and parties." },
  { role: "business_owner", label: "Business Owner", description: "Business events, employee greetings and email campaigns." },
];

export const BUSINESS_HOME_PATH = "/admin/mailer";
export const EVENT_OWNER_HOME_PATH = "/start";

export function isSignupRole(value: unknown): value is SignupRole {
  return value === "event_owner" || value === "business_owner";
}

/** The role saved on a user at sign-up, if any. */
export function signupRoleOf(metadata: unknown): SignupRole | null {
  const role = (metadata as { signup_role?: unknown } | null | undefined)?.signup_role;
  return isSignupRole(role) ? role : null;
}

/** Where a role starts after sign-up. */
export function homePathForRole(role: SignupRole): string {
  return role === "business_owner" ? BUSINESS_HOME_PATH : EVENT_OWNER_HOME_PATH;
}

/** Passwords for the email sign-up form (Supabase's own minimum is 6; we ask for a little more). */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return "Use at least 8 characters for your password.";
  if (password.length > 72) return "Keep the password under 72 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Use at least one letter and one number in your password.";
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}
