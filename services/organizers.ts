import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";

/**
 * "organizer"-role team member (#105) — broader than session_organizer,
 * narrower than "client": real management access (create/edit/delete,
 * not read-only) over one whole event's Invitees, Gallery, Timeline,
 * and Check-In only. No Event Settings, no billing, no AI tools, no
 * managing other organizers. Reuses the exact same two invite
 * mechanisms as services/session-organizers.ts and services/admin-
 * team.ts (emailed invite vs. client-set password) and the same
 * admins-row-plus-Supabase-Auth-user shape — the only difference is
 * `role: "organizer"` and no session assignment table, since an
 * organizer's scope is the whole event's four areas, not specific
 * Event Day sessions.
 */

export interface Organizer {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
}

interface AdminRow {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

/** Every organizer-role admin scoped to this event. */
export async function listOrganizers(eventId: string): Promise<Organizer[]> {
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, name, email, created_at")
    .eq("event_id", eventId)
    .eq("role", "organizer")
    .order("created_at", { ascending: true })
    .returns<AdminRow[]>();

  if (error) throw new Error(`Failed to load organizers: ${error.message}`);
  return (data ?? []).map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    createdAt: admin.created_at,
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

export interface InviteOrganizerInput {
  eventId: string;
  name: string;
  email: string;
}

/** Emailed-invite path — mirrors services/session-organizers.ts's inviteSessionOrganizerByEmail, minus session assignment. */
export async function inviteOrganizerByEmail({ eventId, name, email }: InviteOrganizerInput): Promise<void> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");

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
    role: "organizer",
    event_id: eventId,
  });

  if (insertError) {
    await client.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`Failed to grant access: ${insertError.message}`);
  }
}

export interface AddOrganizerWithPasswordInput {
  eventId: string;
  name: string;
  email: string;
  password: string;
}

/** Client-sets-the-password path — mirrors services/admin-team.ts's addTeamMemberWithPassword. */
export async function addOrganizerWithPassword({
  eventId,
  name,
  email,
  password,
}: AddOrganizerWithPasswordInput): Promise<void> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");
  if (!trimmedEmail) throw new Error("Please enter an email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

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
    role: "organizer",
    event_id: eventId,
  });

  if (insertError) {
    await client.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`Failed to grant access: ${insertError.message}`);
  }
}

/** Removes an organizer's login entirely — mirrors services/session-organizers.ts's removeSessionOrganizer. */
export async function removeOrganizer(eventId: string, adminId: string): Promise<void> {
  const client = supabaseAdmin();

  const { data: target, error: lookupError } = await client
    .from("admins")
    .select("id, event_id, role")
    .eq("id", adminId)
    .maybeSingle<{ id: string; event_id: string | null; role: string }>();

  if (lookupError) throw new Error(`Failed to look up organizer: ${lookupError.message}`);
  if (!target || target.event_id !== eventId || target.role !== "organizer") {
    throw new Error("That organizer doesn't belong to this event.");
  }

  await client.from("admins").delete().eq("id", adminId);

  const { error: authError } = await client.auth.admin.deleteUser(adminId);
  if (authError) {
    throw new Error(`Removed their dashboard access, but couldn't remove their login itself: ${authError.message}`);
  }
}
