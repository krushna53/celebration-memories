import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapEvent, type EventRow } from "@/services/events";
import type { EventRecord, InviteeRecord } from "@/types/event";
import type { AttendanceOption, MealPreference, RsvpRecord } from "@/types/rsvp";

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
  rsvp_status: InviteeRecord["rsvpStatus"];
  checked_in: boolean;
  invite_sent_at: string | null;
  created_at: string;
  updated_at: string;
  events: EventRow;
}

interface RsvpRow {
  invitee_id: string;
  coming: AttendanceOption;
  adults: number;
  children: number;
  meal_preference: MealPreference;
  comments: string | null;
  submitted_at: string;
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
    inviteSentAt: row.invite_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRsvp(row: RsvpRow): RsvpRecord {
  return {
    inviteeId: row.invitee_id,
    coming: row.coming,
    adults: row.adults,
    children: row.children,
    mealPreference: row.meal_preference,
    comments: row.comments,
    submittedAt: row.submitted_at,
  };
}

export interface InviteeWithEvent {
  invitee: InviteeRecord;
  event: EventRecord;
  existingRsvp: RsvpRecord | null;
}

/**
 * Look up a guest by their unique invitation token, joined with the
 * event they're invited to and any RSVP they've already submitted.
 * Returns `null` if the token doesn't match any invitee — callers
 * should render a 404 in that case rather than leaking which tokens
 * are valid.
 */
export async function getInviteeByToken(
  token: string,
): Promise<InviteeWithEvent | null> {
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("invitees")
    .select("*, events(*)")
    .eq("token", token)
    .maybeSingle<InviteeRow>();

  if (error) {
    throw new Error(`Failed to look up invitee: ${error.message}`);
  }
  if (!data) return null;

  const { data: rsvpRow, error: rsvpError } = await client
    .from("rsvps")
    .select("*")
    .eq("invitee_id", data.id)
    .maybeSingle<RsvpRow>();

  if (rsvpError) {
    throw new Error(`Failed to look up RSVP: ${rsvpError.message}`);
  }

  return {
    invitee: mapInvitee(data),
    event: mapEvent(data.events),
    existingRsvp: rsvpRow ? mapRsvp(rsvpRow) : null,
  };
}
