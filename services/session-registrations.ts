import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface SessionRegistrationRecord {
  id: string;
  eventId: string;
  scheduleItemId: string;
  inviteeId: string;
  rsvpPaymentId: string | null;
  createdAt: string;
}

interface SessionRegistrationRow {
  id: string;
  event_id: string;
  schedule_item_id: string;
  invitee_id: string;
  rsvp_payment_id: string | null;
  created_at: string;
}

function mapRow(row: SessionRegistrationRow): SessionRegistrationRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    scheduleItemId: row.schedule_item_id,
    inviteeId: row.invitee_id,
    rsvpPaymentId: row.rsvp_payment_id,
    createdAt: row.created_at,
  };
}

/** Free-session registration, or the record of a paid one once its rsvp_payments row is confirmed paid. Idempotent — a repeat call for the same (session, invitee) pair is a no-op, not an error, since a guest re-visiting shouldn't see a failure. */
export async function createSessionRegistration(input: {
  eventId: string;
  scheduleItemId: string;
  inviteeId: string;
  rsvpPaymentId?: string | null;
}): Promise<SessionRegistrationRecord> {
  const existing = await getSessionRegistration(input.scheduleItemId, input.inviteeId);
  if (existing) return existing;

  const { data, error } = await supabaseAdmin()
    .from("session_registrations")
    .insert({
      event_id: input.eventId,
      schedule_item_id: input.scheduleItemId,
      invitee_id: input.inviteeId,
      rsvp_payment_id: input.rsvpPaymentId ?? null,
    })
    .select("*")
    .single<SessionRegistrationRow>();

  if (error) throw new Error(`Failed to register: ${error.message}`);
  return mapRow(data);
}

export async function getSessionRegistration(scheduleItemId: string, inviteeId: string): Promise<SessionRegistrationRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("session_registrations")
    .select("*")
    .eq("schedule_item_id", scheduleItemId)
    .eq("invitee_id", inviteeId)
    .maybeSingle<SessionRegistrationRow>();

  if (error) throw new Error(`Failed to check registration: ${error.message}`);
  return data ? mapRow(data) : null;
}

/** Every schedule item id this invitee is registered for, across the whole event — used to render "already registered" state on Event Day. */
export async function listRegisteredScheduleItemIds(inviteeId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("session_registrations")
    .select("schedule_item_id")
    .eq("invitee_id", inviteeId)
    .returns<{ schedule_item_id: string }[]>();

  if (error) throw new Error(`Failed to load registrations: ${error.message}`);
  return (data ?? []).map((row) => row.schedule_item_id);
}

interface SessionRegistrationWithInviteeRow extends SessionRegistrationRow {
  invitees: { name: string; phone: string | null; email: string | null } | null;
}

export interface SessionAttendee extends SessionRegistrationRecord {
  inviteeName: string;
  inviteePhone: string | null;
  inviteeEmail: string | null;
}

/** Attendee list for one session — the client's/organizer's "who's registered" view. */
export async function listAttendeesForSession(scheduleItemId: string): Promise<SessionAttendee[]> {
  const { data, error } = await supabaseAdmin()
    .from("session_registrations")
    .select("*, invitees(name, phone, email)")
    .eq("schedule_item_id", scheduleItemId)
    .order("created_at", { ascending: true })
    .returns<SessionRegistrationWithInviteeRow[]>();

  if (error) throw new Error(`Failed to load attendees: ${error.message}`);
  return data.map((row) => ({
    ...mapRow(row),
    inviteeName: row.invitees?.name ?? "",
    inviteePhone: row.invitees?.phone ?? null,
    inviteeEmail: row.invitees?.email ?? null,
  }));
}
