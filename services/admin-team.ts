import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import type { AdminRole } from "@/services/admin-auth";

/**
 * Total admins allowed on one event, INCLUDING the original client
 * (i.e. the client who already has a login can invite up to 3 more
 * people — a family member helping plan, say). Deliberately small and
 * fixed rather than plan-based for now; revisit if a paid tier ever
 * wants a higher cap.
 */
export const TEAM_MEMBER_CAP = 4;

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
  createdAt: string;
}

interface AdminRow {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
  created_at: string;
}

/**
 * Every admin (owner or client) scoped to one event, oldest first —
 * this IS "the team" for that event. Multiple client-role rows sharing
 * the same event_id already works at the data-model level (no unique
 * constraint on admins.event_id) and at the dashboard-resolution level
 * (lib/admin-event.ts's resolveAdminEvent reads each admin's OWN
 * eventId column, not "the" admin for an event) — this feature is
 * purely about letting a client add more of these rows themselves,
 * instead of only the owner being able to create the first one.
 */
export async function getTeamMembers(eventId: string): Promise<TeamMember[]> {
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, name, email, role, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load team members: ${error.message}`);

  return (data as AdminRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));
}

async function assertRoomAndUniqueEmail(eventId: string, email: string): Promise<void> {
  const { count, error: countError } = await supabaseAdmin()
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (countError) throw new Error(`Failed to check team size: ${countError.message}`);
  if ((count ?? 0) >= TEAM_MEMBER_CAP) {
    throw new Error(`This event already has ${TEAM_MEMBER_CAP} team members — remove one before adding another.`);
  }

  const { data: existing, error: existingError } = await supabaseAdmin()
    .from("admins")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle<{ id: string }>();

  if (existingError) throw new Error(`Failed to check existing accounts: ${existingError.message}`);
  if (existing) {
    throw new Error("That email already has dashboard access somewhere — use a different email.");
  }
}

export interface InviteTeamMemberInput {
  eventId: string;
  name: string;
  email: string;
}

/**
 * Sends a Supabase Auth invite email — the family member clicks the
 * link, lands on /admin/set-password (a fresh page this feature adds,
 * since nothing in the app previously needed a "consume an invite/
 * recovery link and set a password" flow), and sets their own
 * password from there. The `admins` row is inserted immediately, not
 * deferred to email confirmation like the owner's existing
 * /admin/register flow (that one waits for a Postgres trigger on
 * email confirmation) — inviteUserByEmail creates the auth.users row
 * right away, so there's no need to replicate that trigger here.
 */
export async function inviteTeamMemberByEmail({ eventId, name, email }: InviteTeamMemberInput): Promise<void> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");

  await assertRoomAndUniqueEmail(eventId, trimmedEmail);

  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.inviteUserByEmail(trimmedEmail, {
    data: { name: trimmedName },
    redirectTo: `${SITE_URL}/admin/set-password`,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to send the invite email.");
  }

  const { error: insertError } = await client.from("admins").insert({
    id: data.user.id,
    email: trimmedEmail,
    name: trimmedName,
    role: "client",
    event_id: eventId,
  });

  if (insertError) {
    // The auth user was created but the allowlist row wasn't — undo the
    // auth side so this doesn't leave a half-provisioned account that
    // can never actually reach the dashboard.
    await client.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`Failed to grant dashboard access: ${insertError.message}`);
  }
}

export interface AddTeamMemberWithPasswordInput {
  eventId: string;
  name: string;
  email: string;
  password: string;
}

/**
 * The other add-a-member path: the client sets the password themselves
 * (rather than the family member setting their own via an emailed
 * link) and shares it with them directly. Creates the account
 * pre-confirmed (email_confirm: true) so it's ready to log in
 * immediately — no email round trip at all.
 */
export async function addTeamMemberWithPassword({
  eventId,
  name,
  email,
  password,
}: AddTeamMemberWithPasswordInput): Promise<void> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  await assertRoomAndUniqueEmail(eventId, trimmedEmail);

  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: trimmedName },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create the account.");
  }

  const { error: insertError } = await client.from("admins").insert({
    id: data.user.id,
    email: trimmedEmail,
    name: trimmedName,
    role: "client",
    event_id: eventId,
  });

  if (insertError) {
    await client.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`Failed to grant dashboard access: ${insertError.message}`);
  }
}

/**
 * Removes a team member's login entirely (both the admins allowlist
 * row and their Supabase Auth account) — same two-step pattern as
 * services/admin-danger-zone.ts's deleteAdminAccountAndAssets, minus
 * the event/asset deletion (removing a team member should never touch
 * the event itself, only that one person's access to it). Re-verifies
 * the target actually belongs to `eventId` server-side rather than
 * trusting the caller, and refuses to remove the last remaining admin
 * for an event so nobody can lock everyone out by mistake.
 */
export async function removeTeamMember(eventId: string, adminId: string): Promise<void> {
  const client = supabaseAdmin();

  const { data: target, error: lookupError } = await client
    .from("admins")
    .select("id, event_id")
    .eq("id", adminId)
    .maybeSingle<{ id: string; event_id: string | null }>();

  if (lookupError) throw new Error(`Failed to look up team member: ${lookupError.message}`);
  if (!target || target.event_id !== eventId) {
    throw new Error("That team member doesn't belong to this event.");
  }

  const { count, error: countError } = await client
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (countError) throw new Error(`Failed to check team size: ${countError.message}`);
  if ((count ?? 0) <= 1) {
    throw new Error("You can't remove the last team member on this event.");
  }

  await client.from("admins").delete().eq("id", adminId);

  const { error: authError } = await client.auth.admin.deleteUser(adminId);
  if (authError) {
    throw new Error(`Removed their dashboard access, but couldn't remove their login itself: ${authError.message}`);
  }
}
