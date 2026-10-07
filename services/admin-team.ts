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
 * Everyone who can manage one event, oldest first — this IS "the team".
 * Members come from admin_event_memberships (a person can be on several
 * events' teams), plus the platform owner if this is their own primary
 * event (the owner never needs a membership row).
 */
export async function getTeamMembers(eventId: string): Promise<TeamMember[]> {
  const client = supabaseAdmin();
  const [{ data: members, error }, { data: owners, error: ownerError }] = await Promise.all([
    client
      .from("admin_event_memberships")
      .select("role, created_at, admins(id, name, email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    client.from("admins").select("id, name, email, role, created_at").eq("event_id", eventId).eq("role", "owner"),
  ]);

  if (error) throw new Error(`Failed to load team members: ${error.message}`);
  if (ownerError) throw new Error(`Failed to load team members: ${ownerError.message}`);

  const team: TeamMember[] = (owners as AdminRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));
  for (const row of members as unknown as { role: AdminRole; created_at: string; admins: { id: string; name: string | null; email: string } | null }[]) {
    if (!row.admins) continue;
    team.push({ id: row.admins.id, name: row.admins.name, email: row.admins.email, role: row.role, createdAt: row.created_at });
  }
  return team.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface EventLogin {
  email: string;
  /** This is the person's primary event (admins.event_id) — shown as the event's owner on /admin/events. */
  isOwner: boolean;
}

/**
 * Client logins per event for the owner's /admin/events table, keyed by
 * event id: each event's owner(s) first — accounts whose primary event
 * it is (`owners`, from listAdmins' resolvedEventId) — then everyone
 * else on its team with full (client) access.
 */
export async function getClientLoginsByEvent(
  owners: { id: string; email: string; eventId: string }[],
): Promise<Map<string, EventLogin[]>> {
  const { data, error } = await supabaseAdmin()
    .from("admin_event_memberships")
    .select("event_id, admin_id, admins(email, role)")
    .eq("role", "client")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load event logins: ${error.message}`);

  const byEvent = new Map<string, EventLogin[]>();
  for (const owner of owners) {
    byEvent.set(owner.eventId, [...(byEvent.get(owner.eventId) ?? []), { email: owner.email, isOwner: true }]);
  }
  const ownerEventById = new Map(owners.map((o) => [o.id, o.eventId]));
  for (const row of data as unknown as { event_id: string; admin_id: string; admins: { email: string; role: AdminRole } | null }[]) {
    if (!row.admins || row.admins.role === "owner" || ownerEventById.get(row.admin_id) === row.event_id) continue;
    byEvent.set(row.event_id, [...(byEvent.get(row.event_id) ?? []), { email: row.admins.email, isOwner: false }]);
  }
  return byEvent;
}

async function countMembers(eventId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("admin_event_memberships")
    .select("admin_id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to check team size: ${error.message}`);
  return count ?? 0;
}

/**
 * Checks there's room on this event's team and works out who `email` is:
 * an existing dashboard account (returned, so they're simply given access
 * to this event too — their other events and password are untouched), or
 * nobody yet (null, so a new account is created).
 */
async function checkRoomAndExisting(
  eventId: string,
  email: string,
  canAddExistingAccounts: boolean,
  makeEventOwner: boolean,
): Promise<{ id: string; alreadyMember: boolean } | null> {
  const roomCheck = async () => {
    if ((await countMembers(eventId)) >= TEAM_MEMBER_CAP) {
      throw new Error(`This event already has ${TEAM_MEMBER_CAP} team members — remove one before adding another.`);
    }
  };

  const { data: existing, error: existingError } = await supabaseAdmin()
    .from("admins")
    .select("id, role")
    .ilike("email", email.trim().replace(/[\\%_]/g, "\\$&"))
    .maybeSingle<{ id: string; role: AdminRole }>();

  if (existingError) throw new Error(`Failed to check existing accounts: ${existingError.message}`);
  if (!existing) {
    await roomCheck();
    return null;
  }
  if (existing.role === "owner") {
    throw new Error("That's the site owner's account — it already has access to every event.");
  }

  const { data: membership } = await supabaseAdmin()
    .from("admin_event_memberships")
    .select("role")
    .eq("admin_id", existing.id)
    .eq("event_id", eventId)
    .maybeSingle<{ role: AdminRole }>();
  if (membership) {
    // Already on the team — the platform owner can still promote a full-access member to event owner.
    if (canAddExistingAccounts && makeEventOwner && membership.role === "client") {
      return { id: existing.id, alreadyMember: true };
    }
    throw new Error("This person is already on this event’s team.");
  }
  await roomCheck();
  // Linking a login that already runs another event is the platform owner's call, not a host's.
  if (!canAddExistingAccounts) {
    throw new Error(
      "This person already uses EveryMoment for another event. Only the EveryMoment team can add them to yours — please contact us and we'll do it.",
    );
  }
  return { id: existing.id, alreadyMember: false };
}

/**
 * Gives an existing dashboard account access to one more event, as its
 * host (skipped when `alreadyMember`). `makeEventOwner` also makes this
 * their primary event (admins.event_id) — the one /admin/events lists
 * them as owner of and the one they land on after signing in.
 * Platform-owner only (callers gate it on canAddExistingAccounts).
 */
async function addMembership(
  { id: adminId, alreadyMember }: { id: string; alreadyMember: boolean },
  eventId: string,
  makeEventOwner: boolean,
): Promise<void> {
  const client = supabaseAdmin();
  if (!alreadyMember) {
    const { error } = await client
      .from("admin_event_memberships")
      .insert({ admin_id: adminId, event_id: eventId, role: "client" });
    if (error) throw new Error(`Failed to grant dashboard access: ${error.message}`);
  }
  if (makeEventOwner) {
    const { error: ownerError } = await client.from("admins").update({ event_id: eventId }).eq("id", adminId);
    if (ownerError) throw new Error(`Couldn't make them the event owner: ${ownerError.message}`);
    return;
  }
  // Someone with no primary event yet (e.g. their only event was deleted) gets this one.
  await client.from("admins").update({ event_id: eventId }).eq("id", adminId).is("event_id", null);
}

/** Recover an existing shared Auth account without changing its credentials. */
async function findExistingAuthUser(email: string, error: { code?: string; message: string }) {
  if (!(["email_exists", "user_already_exists"].includes(error.code ?? "") || /already.*registered|already.*exists/i.test(error.message))) {
    throw new Error(error.message);
  }
  const client = supabaseAdmin();
  for (let page = 1; ; page++) {
    const { data, error: lookupError } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (lookupError) throw new Error(`Failed to check existing login: ${lookupError.message}`);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) throw new Error("Could not find the existing login. Please try again.");
  }
}

export interface InviteTeamMemberInput {
  eventId: string;
  name: string;
  email: string;
  /** Only the platform owner may add someone who already manages another event. */
  canAddExistingAccounts?: boolean;
  /** Existing accounts only (new ones always get this event as their primary): make this their primary event — see addMembership. Ignored unless canAddExistingAccounts. */
  makeEventOwner?: boolean;
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
export async function inviteTeamMemberByEmail({
  eventId,
  name,
  email,
  canAddExistingAccounts = false,
  makeEventOwner = false,
}: InviteTeamMemberInput): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");

  const existingAdmin = await checkRoomAndExisting(eventId, trimmedEmail, canAddExistingAccounts, makeEventOwner);
  if (existingAdmin) {
    // Already has a dashboard login (maybe for another event) — just add this event to it.
    await addMembership(existingAdmin, eventId, canAddExistingAccounts && makeEventOwner);
    return;
  }

  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.inviteUserByEmail(trimmedEmail, {
    data: { name: trimmedName },
    redirectTo: `${SITE_URL}/admin/set-password`,
  });

  const user = error ? await findExistingAuthUser(trimmedEmail, error) : data.user;
  if (!user) throw new Error("Failed to send the invite email.");
  if (error) {
    const { error: resetError } = await client.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${SITE_URL}/admin/set-password`,
    });
    if (resetError) throw new Error(`Failed to send the login email: ${resetError.message}`);
  }

  const { error: insertError } = await client.from("admins").insert({
    id: user.id,
    email: trimmedEmail,
    name: trimmedName,
    role: "client",
    event_id: eventId,
  });

  if (insertError) {
    // The auth user was created but the allowlist row wasn't — undo the
    // auth side so this doesn't leave a half-provisioned account that
    // can never actually reach the dashboard.
    if (!error) await client.auth.admin.deleteUser(user.id).catch(() => {});
    throw new Error(`Failed to grant dashboard access: ${insertError.message}`);
  }
}

export interface AddTeamMemberWithPasswordInput {
  eventId: string;
  name: string;
  email: string;
  password: string;
  /** Only the platform owner may add someone who already manages another event. */
  canAddExistingAccounts?: boolean;
  /** Existing accounts only (new ones always get this event as their primary): make this their primary event — see addMembership. Ignored unless canAddExistingAccounts. */
  makeEventOwner?: boolean;
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
  canAddExistingAccounts = false,
  makeEventOwner = false,
}: AddTeamMemberWithPasswordInput): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existingAdmin = await checkRoomAndExisting(eventId, trimmedEmail, canAddExistingAccounts, makeEventOwner);
  if (existingAdmin) {
    // Already has a dashboard login — add this event to it; their password is left exactly as it was.
    await addMembership(existingAdmin, eventId, canAddExistingAccounts && makeEventOwner);
    return;
  }

  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: trimmedName },
  });

  const user = error ? await findExistingAuthUser(trimmedEmail, error) : data.user;
  if (!user) throw new Error("Failed to create the account.");

  const { error: insertError } = await client.from("admins").insert({
    id: user.id,
    email: trimmedEmail,
    name: trimmedName,
    role: "client",
    event_id: eventId,
  });

  if (insertError) {
    if (!error) await client.auth.admin.deleteUser(user.id).catch(() => {});
    throw new Error(`Failed to grant dashboard access: ${insertError.message}`);
  }
}

/**
 * Removes one person's access to one event. Their other events (and
 * their login) are untouched; only if this was their last event is the
 * dashboard account itself removed, as before.
 */
export async function removeTeamMember(eventId: string, adminId: string): Promise<void> {
  const client = supabaseAdmin();

  const { data: membership, error: lookupError } = await client
    .from("admin_event_memberships")
    .select("admin_id")
    .eq("admin_id", adminId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (lookupError) throw new Error(`Failed to look up team member: ${lookupError.message}`);
  if (!membership) throw new Error("That team member doesn't belong to this event.");

  if ((await countMembers(eventId)) <= 1) {
    throw new Error("You can't remove the last team member on this event.");
  }

  const { error: deleteError } = await client
    .from("admin_event_memberships")
    .delete()
    .eq("admin_id", adminId)
    .eq("event_id", eventId);
  if (deleteError) throw new Error(`Failed to remove dashboard access: ${deleteError.message}`);

  const { data: remaining } = await client
    .from("admin_event_memberships")
    .select("event_id")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
    .limit(1);
  const next = (remaining as { event_id: string }[] | null)?.[0];

  if (!next) {
    const { error } = await client.from("admins").delete().eq("id", adminId).neq("role", "owner");
    if (error) throw new Error(`Failed to remove dashboard access: ${error.message}`);
    return;
  }
  // Their primary event pointer moves to another event they still manage.
  await client.from("admins").update({ event_id: next.event_id }).eq("id", adminId).eq("event_id", eventId);
}
