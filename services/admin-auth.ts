import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAssignedSessionIds } from "@/services/session-organizers";

/**
 * "session_organizer" (added for #63) is a much narrower role than
 * "client" — scoped not just to one event but to one or more specific
 * Event Day sessions within it (see session_organizer_assignments,
 * services/session-organizers.ts). They can only view their own
 * session's attendee list + payments — see lib/admin-roles.ts's
 * SESSION_ORGANIZER_ALLOWED_PATHS for the (very short) allow-list.
 *
 * "organizer" (#105) sits between the two: scoped to one whole event
 * like "client", but only for four specific areas — Invitees, Gallery,
 * Timeline, and Check-In — with no access to Event Settings, billing,
 * AI tools, or anything else "client" can reach. Created and removed by
 * the owner/client via services/organizers.ts (mirrors
 * services/session-organizers.ts's two invite mechanisms). See
 * lib/admin-roles.ts's ORGANIZER_ALLOWED_PATHS/shouldRedirectOrganizerAway
 * for the page-level allow-list, and requireAdminForOrganizerArea below
 * for the Server Action gate.
 */
export type AdminRole = "owner" | "client" | "session_organizer" | "organizer";

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
 *
 * session_organizer (#63) is deliberately rejected here, even though
 * its admins.event_id is set the same way a client's is — every
 * requireAdminForEvent-gated action represents real event-management
 * (create/update/delete something), which is out of scope for a role
 * that's meant to be read-only over one or two sessions. Their reads
 * (getAssignedSessionIds, listAttendeesForSession,
 * listRsvpPaymentsForScheduleItem) are called directly from
 * /admin/my-sessions, gated by that page's own
 * `admin.role !== "session_organizer"` check, not through this
 * function — so this reject is the single choke point that keeps a
 * session organizer from reaching any client-level mutation even by
 * navigating straight to a client page's URL or its Server Action.
 *
 * organizer (#105) is rejected here for the same structural reason,
 * even though it's a much broader role than session_organizer — it's
 * still meant to be confined to exactly four areas (Invitees, Gallery,
 * Timeline, Check-In), and this function is shared by every other
 * event-scoped action (Event Settings, Memories, Media Library, AI
 * tools, payments, backups, and more). Actions in those four areas call
 * requireAdminForOrganizerArea below instead, which admits organizer
 * (and, for three of the four, "client" too) — everything else keeps
 * using this function so organizer's reach can never silently widen by
 * a future action forgetting to special-case it.
 */
export async function requireAdminForEvent(eventId: string): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role === "session_organizer") {
    throw new Error("Session organizers have read-only access — this action isn't available to your account.");
  }
  if (admin.role === "organizer") {
    throw new Error("Organizers have access to Invitees, Gallery, Timeline, and Check-In only — this action isn't available to your account.");
  }
  if (admin.role !== "owner" && admin.eventId !== eventId) {
    throw new Error("You don't have access to this event.");
  }
  return admin;
}

export type OrganizerArea = "invitees" | "gallery" | "timeline" | "checkin";

/**
 * The event-scoped gate for the four areas the "organizer" role (#105)
 * may manage — like requireAdminForEvent, but additionally admits an
 * organizer-role admin scoped to this event. Every other
 * requireAdminForEvent-gated action (Event Settings, Memories, Media
 * Library, AI tools, payments, backups, etc.) must keep calling
 * requireAdminForEvent directly instead, so organizer access stays
 * confined to exactly these four areas — see lib/admin-roles.ts's
 * ORGANIZER_ALLOWED_PATHS for the matching page-level allow-list.
 *
 * "checkin" is the one area of the four a plain "client" admin does
 * NOT already have (toggleCheckInAction has stayed owner-only since
 * Check-In first shipped) — the `area` param preserves that: "checkin"
 * only admits owner or organizer, the other three areas admit owner,
 * client, or organizer, matching each area's pre-existing access level
 * plus organizer.
 */
export async function requireAdminForOrganizerArea(eventId: string, area: OrganizerArea): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role === "owner") return admin;
  if (admin.eventId !== eventId) throw new Error("You don't have access to this event.");
  if (admin.role === "organizer") return admin;
  if (admin.role === "client" && area !== "checkin") return admin;
  throw new Error("You don't have access to this feature.");
}

/**
 * Narrow, additive gate for #106: a session_organizer may submit their
 * OWN session's payment settings (self-serve, still owner-approved
 * before it goes live — see submitEventPaymentSettings's doc comment),
 * even though requireAdminForEvent above rejects the role outright for
 * every other event-scoped action. Deliberately a separate function
 * rather than widening requireAdminForEvent itself, so that choke
 * point's guarantee ("session_organizer can never reach a client-level
 * mutation") stays true for every action except this one, explicitly
 * opted-in action. Re-verifies the assignment server-side via
 * session_organizer_assignments — never trusts that a scheduleItemId
 * from a client belongs to the caller.
 */
export async function requireSessionOrganizerForSession(scheduleItemId: string): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role !== "session_organizer") {
    throw new Error("This action is only available to session organizer accounts.");
  }

  const assignedIds = await getAssignedSessionIds(admin.id);
  if (!assignedIds.includes(scheduleItemId)) {
    throw new Error("You aren't assigned to this session.");
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

