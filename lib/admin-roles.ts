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
  "/admin/domain-search",
  "/admin/help",
];

export function isPathAllowedForRole(path: string, role: AdminRole): boolean {
  if (role === "owner") return true;
  return CLIENT_ALLOWED_PATHS.includes(path);
}
