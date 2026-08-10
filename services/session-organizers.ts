import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";

/**
 * "session_organizer"-role team member, scoped to one or more Event Day
 * sessions rather than the whole event — the #63 counterpart to
 * services/admin-team.ts's "client" team members. Reuses the exact same
 * two invite mechanisms (emailed invite vs. client-set password) and
 * the same admins-row-plus-Supabase-Auth-user shape; the only real
 * difference is `role: "session_organizer"` plus rows in
 * session_organizer_assignments scoping which session(s) they can see.
 */

export interface SessionOrganizer {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  sessionIds: string[];
}

interface AdminRow {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

/** Every session_organizer admin scoped to this event, with which sessions each can see. */
export async function listSessionOrganizers(eventId: string): Promise<SessionOrganizer[]> {
  const client = supabaseAdmin();

  const { data: admins, error } = await client
    .from("admins")
    .select("id, name, email, created_at")
    .eq("event_id", eventId)
    .eq("role", "session_organizer")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load session organizers: ${error.message}`);
  const adminRows = (admins ?? []) as AdminRow[];
  if (adminRows.length === 0) return [];

  const { data: assignments, error: assignmentsError } = await client
    .from("session_organizer_assignments")
    .select("admin_id, schedule_item_id")
    .in(
      "admin_id",
      adminRows.map((a) => a.id),
    )
    .returns<{ admin_id: string; schedule_item_id: string }[]>();

  if (assignmentsError) throw new Error(`Failed to load session assignments: ${assignmentsError.message}`);

  return adminRows.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    createdAt: admin.created_at,
    sessionIds: (assignments ?? []).filter((a) => a.admin_id === admin.id).map((a) => a.schedule_item_id),
  }));
}

async function assertUniqueEmail(email: string): Promise<void> {
  const { data: existing, error } = await supabaseAdmin()
    .from("admins")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(`Failed to check existing accounts: ${error.message}`);
  if (existing) throw new Error("That email already has dashboard access somewhere — use a different email.");
}

async function assignSessions(adminId: string, scheduleItemIds: string[]): Promise<void> {
  if (scheduleItemIds.length === 0) return;
  const { error } = await supabaseAdmin()
    .from("session_organizer_assignments")
    .insert(scheduleItemIds.map((scheduleItemId) => ({ admin_id: adminId, schedule_item_id: scheduleItemId })));
  if (error) throw new Error(`Failed to assign sessions: ${error.message}`);
}

export interface InviteSessionOrganizerInput {
  eventId: string;
  name: string;
  email: string;
  scheduleItemIds: string[];
}

/** Emailed-invite path — mirrors services/admin-team.ts's inviteTeamMemberByEmail exactly, minus the team-size cap (organizers aren't part of that 4-person team cap) and with role "session_organizer" + session assignments instead. */
export async function inviteSessionOrganizerByEmail({ eventId, name, email, scheduleItemIds }: InviteSessionOrganizerInput): Promise<void> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");
  if (scheduleItemIds.length === 0) throw new Error("Please select at least one session.");

  await assertUniqueEmail(trimmedEmail);

  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.inviteUserByEmail(trimmedEmail, {
    data: { name: trimmedName },
    redirectTo: `${SITE_URL}/admin/set-password`,
  });

  if (error || !data.user) throw new Error(error?.message ?? "Failed to send the invite email.");

  const { error: insertError } = await client.from("admins").insert({
    id: data.user.id,
    email: trimmedEmail,
    name: trimmedName,
    role: "session_organizer",
    event_id: eventId,
  });

  if (insertError) {
    await client.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`Failed to grant access: ${insertError.message}`);
  }

  await assignSessions(data.user.id, scheduleItemIds);
}

export interface AddSessionOrganizerWithPasswordInput {
  eventId: string;
  name: string;
  email: string;
  password: string;
  scheduleItemIds: string[];
}

/** Client-sets-the-password path — mirrors services/admin-team.ts's addTeamMemberWithPassword. */
export async function addSessionOrganizerWithPassword({
  eventId,
  name,
  email,
  password,
  scheduleItemIds,
}: AddSessionOrganizerWithPasswordInput): Promise<void> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (scheduleItemIds.length === 0) throw new Error("Please select at least one session.");

  await assertUniqueEmail(trimmedEmail);

  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: trimmedName },
  });

  if (error || !data.user) throw new Error(error?.message ?? "Failed to create the account.");

  const { error: insertError } = await client.from("admins").insert({
    id: data.user.id,
    email: trimmedEmail,
    name: trimmedName,
    role: "session_organizer",
    event_id: eventId,
  });

  if (insertError) {
    await client.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`Failed to grant access: ${insertError.message}`);
  }

  await assignSessions(data.user.id, scheduleItemIds);
}

/** Removes a session organizer's login entirely — mirrors services/admin-team.ts's removeTeamMember, minus the "don't remove the last admin" guard (an event never depends on having at least one organizer). */
export async function removeSessionOrganizer(eventId: string, adminId: string): Promise<void> {
  const client = supabaseAdmin();

  const { data: target, error: lookupError } = await client
    .from("admins")
    .select("id, event_id, role")
    .eq("id", adminId)
    .maybeSingle<{ id: string; event_id: string | null; role: string }>();

  if (lookupError) throw new Error(`Failed to look up organizer: ${lookupError.message}`);
  if (!target || target.event_id !== eventId || target.role !== "session_organizer") {
    throw new Error("That organizer doesn't belong to this event.");
  }

  await client.from("admins").delete().eq("id", adminId);

  const { error: authError } = await client.auth.admin.deleteUser(adminId);
  if (authError) {
    throw new Error(`Removed their dashboard access, but couldn't remove their login itself: ${authError.message}`);
  }
}

/** Which schedule item ids a session_organizer admin can see — the access boundary enforced on /admin/my-sessions and its Server Actions. */
export async function getAssignedSessionIds(adminId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("session_organizer_assignments")
    .select("schedule_item_id")
    .eq("admin_id", adminId)
    .returns<{ schedule_item_id: string }[]>();

  if (error) throw new Error(`Failed to load assigned sessions: ${error.message}`);
  return (data ?? []).map((row) => row.schedule_item_id);
}

/** Every session_organizer admin assigned to ONE session — used to notify organizers when a payment/registration comes in for their session. */
export async function getOrganizersForSession(scheduleItemId: string): Promise<{ id: string; email: string; name: string | null }[]> {
  const client = supabaseAdmin();

  const { data: assignments, error } = await client
    .from("session_organizer_assignments")
    .select("admin_id")
    .eq("schedule_item_id", scheduleItemId)
    .returns<{ admin_id: string }[]>();

  if (error) throw new Error(`Failed to load session organizers: ${error.message}`);
  if (!assignments || assignments.length === 0) return [];

  const { data: admins, error: adminsError } = await client
    .from("admins")
    .select("id, email, name")
    .in(
      "id",
      assignments.map((a) => a.admin_id),
    )
    .returns<{ id: string; email: string; name: string | null }[]>();

  if (adminsError) throw new Error(`Failed to load session organizers: ${adminsError.message}`);
  return admins ?? [];
}
