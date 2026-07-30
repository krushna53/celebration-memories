import "server-only";
import { cookies } from "next/headers";

/**
 * Lets the owner (Krushna Web Works) "step into" managing any one
 * client's event from the same admin dashboard, instead of every admin
 * page being permanently locked to the single flagship EVENT_SLUG event.
 * See app/admin/(dashboard)/events/page.tsx (the "All Events" list where
 * this gets set) and lib/admin-event.ts's resolveAdminEvent (where it
 * gets read).
 *
 * Deliberately a plain cookie, not a DB column: this is a per-browser
 * "what am I looking at right now" setting, not part of the admin's
 * identity, so it shouldn't follow them to a different browser/device
 * and shouldn't need a migration to add. Only ever consulted for
 * owner-role admins — client-role admins are always locked to their own
 * admins.event_id regardless of this cookie (see resolveAdminEvent).
 */
const COOKIE_NAME = "cm_admin_active_event";

/** Read-only — safe to call from any Server Component render. */
export async function getActiveEventOverrideId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** Mutates cookies — only callable from a Server Action or Route Handler. */
export async function setActiveEventOverrideId(eventId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, eventId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Mutates cookies — only callable from a Server Action or Route Handler.
 *
 * Deliberately overwrites with an empty, already-expired cookie at the
 * *same* path used in setActiveEventOverrideId, rather than calling
 * store.delete(COOKIE_NAME). A bare delete-by-name defaults to path
 * "/" — since the cookie was set at path "/admin", that mismatch means
 * the browser treats them as two different cookies and never actually
 * clears the "/admin"-scoped one. The practical symptom: "Exit to All
 * Events" redirects to /admin/events, but the override cookie is still
 * sitting there, so the very next admin page read sees it again and the
 * owner looks stuck managing the same client's event.
 */
export async function clearActiveEventOverrideId(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  });
}
