import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import type { AdminRole } from "@/services/admin-auth";

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  /** Which event this account's dashboard resolves to — see lib/admin-event.ts's resolveAdminEvent. Null only if the event itself couldn't be found (e.g. deleted). */
  eventLabel: string | null;
  /**
   * The same event, as an id rather than a display label — null for
   * owner rows (an owner isn't "the" client of any one event) and for
   * client rows whose event genuinely couldn't be resolved. Used by
   * /admin/events (features/admin/events/event-list.tsx) to show which
   * client email(s) are attached to each event in the list.
   */
  resolvedEventId: string | null;
  createdAt: string;
}

/**
 * Every row in `admins` — i.e. everyone who can sign in to the
 * dashboard at all, as opposed to `invitees` (event guests, no login).
 * Powers the owner-only Members page (app/admin/(dashboard)/members).
 *
 * A client-role admin's `event_id` is null for accounts created before
 * the self-serve wizard existed (see services/admin-auth.ts's
 * CurrentAdmin.eventId doc comment) — those resolve to the flagship
 * EVENT_SLUG event today, same as resolveAdminEvent() does, so the
 * label shown here matches what that account actually sees when they
 * log in.
 */
export async function listAdmins(): Promise<AdminUserSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, email, name, role, event_id, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list admin accounts: ${error.message}`);

  const rows = data as {
    id: string;
    email: string;
    name: string | null;
    role: AdminRole;
    event_id: string | null;
    created_at: string;
  }[];

  const eventIds = [...new Set(rows.filter((r) => r.event_id).map((r) => r.event_id as string))];

  const eventLabels = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: events } = await supabaseAdmin()
      .from("events")
      .select("id, honoree_name")
      .in("id", eventIds);
    for (const e of (events ?? []) as { id: string; honoree_name: string }[]) {
      eventLabels.set(e.id, e.honoree_name);
    }
  }

  const flagship = await getEventBySlug(EVENT_SLUG);

  return rows.map((row) => {
    const resolvedEventId = row.role === "owner" ? null : (row.event_id ?? flagship?.id ?? null);
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      eventLabel:
        row.role === "owner" ? null : row.event_id ? (eventLabels.get(row.event_id) ?? null) : (flagship?.honoreeName ?? null),
      resolvedEventId,
      createdAt: row.created_at,
    };
  });
}

/**
 * Revokes a client's dashboard access by deleting their `admins` row.
 * Deliberately does NOT delete their Supabase Auth user — this is an
 * access revocation, not an account deletion, and undoing it later is
 * as simple as re-inserting the row (see the README's "Admin roles"
 * section for the manual-SQL method). Owner-only; callers must also
 * guard against removing an owner account or the caller's own row (see
 * features/admin/members/actions.ts).
 */
export async function deleteAdminAccess(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("admins").delete().eq("id", id).eq("role", "client");
  if (error) throw new Error(`Failed to remove admin access: ${error.message}`);
}
