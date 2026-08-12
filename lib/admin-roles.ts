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
  "/admin/apps",
  "/admin/event-settings",
  "/admin/team",
  "/admin/templates",
  "/admin/invitees",
  "/admin/gallery",
  "/admin/timeline",
  "/admin/event-day",
  "/admin/memories",
  "/admin/media-library",
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
  "/admin/organizers",
  "/admin/backups",
  "/admin/recycle-bin",
  "/admin/delete-account",
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

/**
 * An organizer (#105) sits between "client" and "session_organizer" —
 * real management access (not read-only), but confined to one whole
 * event's Invitees, Gallery, Timeline, and Check-In. No Overview cards,
 * no Event Settings, no billing, no AI tools, no "/admin/organizers"
 * itself (an organizer can't manage other organizers). See
 * services/admin-auth.ts's requireAdminForOrganizerArea for the
 * matching Server Action gate, and shouldRedirectOrganizerAway below
 * for the direct-navigation guard applied to every page this list
 * excludes.
 */
export const ORGANIZER_ALLOWED_PATHS: readonly string[] = [
  "/admin",
  "/admin/invitees",
  "/admin/gallery",
  "/admin/timeline",
  "/admin/checkin",
  "/admin/help",
];

export function isPathAllowedForRole(path: string, role: AdminRole): boolean {
  if (role === "owner") return true;
  if (role === "session_organizer") return SESSION_ORGANIZER_ALLOWED_PATHS.includes(path);
  if (role === "organizer") return ORGANIZER_ALLOWED_PATHS.includes(path);
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

/**
 * Same reasoning as shouldRedirectSessionOrganizerAway above, for the
 * organizer role (#105): nav-hiding alone (isPathAllowedForRole) only
 * hides a link, it doesn't stop a direct visit to a page outside
 * ORGANIZER_ALLOWED_PATHS. Applied on every admin page that already
 * carries the session_organizer redirect, except Invitees/Gallery/
 * Timeline/Check-In/Help, which organizer is actually allowed to see.
 * A separate function (not folded into shouldRedirectSessionOrganizerAway)
 * so each caller can redirect to a sensible home for that role —
 * session_organizer goes to /admin/my-sessions, organizer goes to
 * /admin/invitees.
 */
export function shouldRedirectOrganizerAway(role: AdminRole): boolean {
  return role === "organizer";
}
