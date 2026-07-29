import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminRole = "owner" | "client";

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  /** Whether this admin has already dismissed/finished the interactive dashboard tour once. See features/admin/tour/. */
  hasSeenTour: boolean;
  /**
   * Non-null only for client-role admins created through the self-serve
   * onboarding wizard (see services/event-drafts.ts) — scopes them to
   * exactly that one event. Null (the default, for every pre-existing
   * admin including you) means "unscoped", which today still resolves
   * to the single EVENT_SLUG event everywhere — see
   * lib/admin-event.ts's resolveAdminEvent().
   */
  eventId: string | null;
}

/**
 * Resolves the signed-in Supabase Auth user (if any) and checks them
 * against the `admins` allowlist table. Being a valid Supabase Auth user
 * is not sufficient on its own — only rows present in `admins` may reach
 * the dashboard, so provisioning a new admin is a deliberate two-step
 * process (create the auth user, then add them to `admins`).
 *
 * `role` gates which parts of the dashboard an admin can see:
 * - "owner" (Krushna Web Works) — everything.
 * - "client" (the event host) — event content only: Overview, Event
 *   Settings, Templates, Gallery, Timeline, Memories. See
 *   lib/admin-roles.ts for the exact allow-list and how to change it.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await supabaseServer();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, email, name, role, has_seen_tour, event_id")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      email: string;
      name: string | null;
      role: AdminRole;
      has_seen_tour: boolean;
      event_id: string | null;
    }>();

  if (error) {
    console.error("Failed to check admins allowlist:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    hasSeenTour: data.has_seen_tour,
    eventId: data.event_id,
  };
}

/**
 * For Server Actions that are owner-only (Referrals, Inquiries,
 * Check-In). Throws rather than returning a boolean so callers can't
 * accidentally ignore the result — every owner-only action must call
 * this before doing anything.
 */
export async function requireOwner(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role !== "owner") throw new Error("This action is restricted to the site owner.");
  return admin;
}

/**
 * For Server Actions available to both roles but scoped to one event
 * (Invitees) — owner can manage any event's invitees (consistent with
 * "step into any event" elsewhere), a client can only manage the one
 * event tied to their own admins.event_id. Throws rather than returning
 * a boolean for the same reason as requireOwner. Callers that only have
 * a resource id (an invitee id, not an eventId) should still look up
 * that resource's own event_id and scope their query by it directly —
 * see services/admin-invitees.ts — rather than relying on this check
 * alone, so a client can never affect another client's row even if they
 * tamper with the eventId this receives.
 */
export async function requireAdminForEvent(eventId: string): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role !== "owner" && admin.eventId !== eventId) {
    throw new Error("You don't have access to this event.");
  }
  return admin;
}

/**
 * Looks up the client-role admin scoped to a specific event, if one
 * exists — used by the wizard's payment step (features/start/actions/payment.ts)
 * to confirm the host actually finished account creation (i.e. clicked
 * their email verification link, which is what creates this row — see
 * the handle_new_confirmed_admin trigger) before letting them pay. Not
 * session-based, since the wizard visitor has no admin session yet.
 */
export async function getAdminByEventId(
  eventId: string,
): Promise<{ id: string; email: string; name: string | null } | null> {
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, email, name")
    .eq("event_id", eventId)
    .maybeSingle<{ id: string; email: string; name: string | null }>();

  if (error) {
    console.error("getAdminByEventId failed:", error.message);
    return null;
  }
  return data;
}

