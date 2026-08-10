import type { AdminRole } from "@/services/admin-auth";

/**
 * Single source of truth for what a "client" admin (the event host) can
 * reach, vs. what's reserved for "owner" (Krushna Web Works). Every
 * owner-only page/action checks against this list — see
 * requireOwner() below and app/admin/(dashboard)/layout.tsx.
 *
 * To give clients access to something else (e.g. Check-In, so a family
 * member can check guests in at the door), just add its path here.
 */
export const CLIENT_ALLOWED_PATHS: readonly string[] = [
  "/admin",
  "/admin/event-settings",
  "/admin/team",
  "/admin/templates",
  "/admin/invitees",
  "/admin/gallery",
  "/admin/timeline",
  "/admin/event-day",
  "/admin/memories",
  "/admin/planner",
  "/admin/games",
  "/admin/share-image",
  "/admin/ai-image",
  "/admin/slideshow",
  "/admin/video-editor",
  "/admin/domain-search",
  "/admin/payment-settings-request",
  "/admin/rsvp-payments",
  "/admin/session-organizers",
  "/admin/help",
];

/**
 * A session_organizer (#63) is scoped even narrower than "client" —
 * just their own assigned session(s)' attendee list + payments, read-
 * only. No Overview, no Event Settings, no anything else — this is a
 * genuinely separate, much shorter allow-list, not a subset check
 * against CLIENT_ALLOWED_PATHS.
 */
export const SESSION_ORGANIZER_ALLOWED_PATHS: readonly string[] = ["/admin/my-sessions", "/admin/help"];

export function isPathAllowedForRole(path: string, role: AdminRole): boolean {
  if (role === "owner") return true;
  if (role === "session_organizer") return SESSION_ORGANIZER_ALLOWED_PATHS.includes(path);
  return CLIENT_ALLOWED_PATHS.includes(path);
}

/**
 * Whether `admin` should be redirected away from a page carrying real
 * guest PII or financial data if they navigate to it directly by URL —
 * nav filtering alone (isPathAllowedForRole) only hides the link, it
 * doesn't stop a direct visit. Server Action mutations are already
 * blocked for session_organizer at the source (requireAdminForEvent in
 * services/admin-auth.ts rejects the role outright), so this is about
 * closing the read-only info leak on the highest-sensitivity pages
 * specifically (full invitee list, payment credentials, every guest's
 * payment across the whole event) — not yet applied to every lower-
 * sensitivity page (Gallery, Timeline, Templates, Games, Planner, etc.),
 * which remains a known follow-up.
 */
export function shouldRedirectSessionOrganizerAway(role: AdminRole): boolean {
  return role === "session_organizer";
}
