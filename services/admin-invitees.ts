import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateInviteToken } from "@/lib/tokens";
import type { InviteeRecord, RsvpStatus } from "@/types/event";

interface InviteeRow {
  id: string;
  event_id: string;
  token: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  visit_count: number;
  rsvp_status: RsvpStatus;
  checked_in: boolean;
  created_at: string;
  updated_at: string;
}

function mapInvitee(row: InviteeRow): InviteeRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    token: row.token,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    openedAt: row.opened_at,
    lastOpenedAt: row.last_opened_at,
    visitCount: row.visit_count,
    rsvpStatus: row.rsvp_status,
    checkedIn: row.checked_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listInvitees(eventId: string): Promise<InviteeRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("invitees")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list invitees: ${error.message}`);
  return (data as InviteeRow[]).map(mapInvitee);
}

async function uniqueToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateInviteToken();
    const { data } = await supabaseAdmin()
      .from("invitees")
      .select("id")
      .eq("token", token)
      .maybeSingle();
    if (!data) return token;
  }
  throw new Error("Could not generate a unique invite token — please retry.");
}

export interface InviteeInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
}

export async function createInvitee(eventId: string, input: InviteeInput): Promise<InviteeRecord> {
  const token = await uniqueToken();

  const { data, error } = await supabaseAdmin()
    .from("invitees")
    .insert({
      event_id: eventId,
      token,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      relationship: input.relationship || null,
    })
    .select("*")
    .single<InviteeRow>();

  if (error || !data) throw new Error(`Failed to create invitee: ${error?.message}`);
  return mapInvitee(data);
}

export async function updateInvitee(id: string, input: InviteeInput): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("invitees")
    .update({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      relationship: input.relationship || null,
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update invitee: ${error.message}`);
}

export async function deleteInvitee(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("invitees").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete invitee: ${error.message}`);
}

export async function setCheckedIn(id: string, checkedIn: boolean): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("invitees")
    .update({ checked_in: checkedIn })
    .eq("id", id);
  if (error) throw new Error(`Failed to update check-in: ${error.message}`);
}

/** Bulk-creates invitees from parsed CSV rows, skipping rows without a name. */
export async function bulkImportInvitees(
  eventId: string,
  rows: InviteeInput[],
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.name?.trim()) {
      skipped++;
      continue;
    }
    await createInvitee(eventId, row);
    created++;
  }

  return { created, skipped };
}
