import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateInviteToken } from "@/lib/tokens";

export interface SessionRegistrationRecord {
  id: string;
  eventId: string;
  scheduleItemId: string;
  inviteeId: string;
  rsvpPaymentId: string | null;
  createdAt: string;
  /** Short, easy-to-read/type check-in code (#106) — same alphabet as invite tokens, scanned as a QR or typed manually at the door. Set once at registration time; never regenerated (unlike share_token/draft_token), since re-issuing it would silently invalidate a QR a guest may have already saved/printed. */
  qrToken: string;
  /** Set when a host/organizer has checked this guest in for this session — null means not yet arrived. */
  attendedAt: string | null;
  checkedInBy: string | null;
}

interface SessionRegistrationRow {
  id: string;
  event_id: string;
  schedule_item_id: string;
  invitee_id: string;
  rsvp_payment_id: string | null;
  created_at: string;
  qr_token: string;
  attended_at: string | null;
  checked_in_by: string | null;
}

function mapRow(row: SessionRegistrationRow): SessionRegistrationRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    scheduleItemId: row.schedule_item_id,
    inviteeId: row.invitee_id,
    rsvpPaymentId: row.rsvp_payment_id,
    createdAt: row.created_at,
    qrToken: row.qr_token,
    attendedAt: row.attended_at,
    checkedInBy: row.checked_in_by,
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
      qr_token: generateInviteToken(),
    })
    .select("*")
    .single<SessionRegistrationRow>();

  if (error) throw new Error(`Failed to register: ${error.message}`);
  return mapRow(data);
}

/** Scan/lookup entry point for check-in (#106) — resolves a registration by its QR/check-in code, scoped to the session it's presented at so a code from a DIFFERENT session (or event) can't be used here. */
export async function getRegistrationByQrToken(scheduleItemId: string, qrToken: string): Promise<SessionRegistrationRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("session_registrations")
    .select("*")
    .eq("schedule_item_id", scheduleItemId)
    .eq("qr_token", qrToken.trim().toUpperCase())
    .maybeSingle<SessionRegistrationRow>();

  if (error) throw new Error(`Failed to look up check-in code: ${error.message}`);
  return data ? mapRow(data) : null;
}

export async function getRegistrationById(id: string): Promise<SessionRegistrationRecord | null> {
  const { data, error } = await supabaseAdmin().from("session_registrations").select("*").eq("id", id).maybeSingle<SessionRegistrationRow>();
  if (error) throw new Error(`Failed to look up registration: ${error.message}`);
  return data ? mapRow(data) : null;
}

/** Marks a registration attended — idempotent (re-scanning an already-checked-in guest doesn't error or overwrite who originally checked them in). */
export async function checkInRegistration(id: string, checkedInByAdminId: string): Promise<SessionRegistrationRecord> {
  const { data, error } = await supabaseAdmin()
    .from("session_registrations")
    .update({ attended_at: new Date().toISOString(), checked_in_by: checkedInByAdminId })
    .eq("id", id)
    .is("attended_at", null)
    .select("*")
    .maybeSingle<SessionRegistrationRow>();

  if (error) throw new Error(`Failed to check in: ${error.message}`);
  if (data) return mapRow(data);

  // Already checked in — return the existing row rather than erroring, so a double-scan is a harmless no-op.
  const existing = await supabaseAdmin().from("session_registrations").select("*").eq("id", id).single<SessionRegistrationRow>();
  if (existing.error) throw new Error(`Failed to check in: ${existing.error.message}`);
  return mapRow(existing.data);
}

/** Reverses an accidental check-in. */
export async function undoCheckIn(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("session_registrations")
    .update({ attended_at: null, checked_in_by: null })
    .eq("id", id);
  if (error) throw new Error(`Failed to undo check-in: ${error.message}`);
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
