import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RsvpPaymentRecord, RsvpPaymentStatus } from "@/types/rsvp-payment";

interface RsvpPaymentRow {
  id: string;
  event_id: string;
  invitee_id: string;
  schedule_item_id: string | null;
  amount: number;
  currency: string;
  pricing_tier: RsvpPaymentRecord["pricingTier"];
  provider: RsvpPaymentRecord["provider"];
  status: RsvpPaymentStatus;
  external_id: string | null;
  reference_note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
}

function mapRow(row: RsvpPaymentRow): RsvpPaymentRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    inviteeId: row.invitee_id,
    scheduleItemId: row.schedule_item_id,
    amount: row.amount,
    currency: row.currency,
    pricingTier: row.pricing_tier,
    provider: row.provider,
    status: row.status,
    externalId: row.external_id,
    referenceNote: row.reference_note,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    paidAt: row.paid_at,
  };
}

export async function createRsvpPayment(input: {
  eventId: string;
  inviteeId: string;
  scheduleItemId?: string | null;
  amount: number;
  currency: string;
  pricingTier: RsvpPaymentRecord["pricingTier"];
  provider: RsvpPaymentRecord["provider"];
  referenceNote?: string | null;
}): Promise<RsvpPaymentRecord> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .insert({
      event_id: input.eventId,
      invitee_id: input.inviteeId,
      schedule_item_id: input.scheduleItemId ?? null,
      amount: input.amount,
      currency: input.currency,
      pricing_tier: input.pricingTier,
      provider: input.provider,
      reference_note: input.referenceNote ?? null,
    })
    .select("*")
    .single<RsvpPaymentRow>();

  if (error) throw new Error(`Failed to start payment: ${error.message}`);
  return mapRow(data);
}

export async function getRsvpPaymentById(id: string): Promise<RsvpPaymentRecord | null> {
  const { data, error } = await supabaseAdmin().from("rsvp_payments").select("*").eq("id", id).maybeSingle<RsvpPaymentRow>();
  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  return data ? mapRow(data) : null;
}

/** Most recent event-level (non-session) payment for this invitee — used to short-circuit the RSVP payment panel ("you've already paid") on a repeat visit. */
export async function getLatestRsvpPaymentForInvitee(inviteeId: string): Promise<RsvpPaymentRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .select("*")
    .eq("invitee_id", inviteeId)
    .is("schedule_item_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RsvpPaymentRow>();

  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  return data ? mapRow(data) : null;
}

/** Most recent payment for this invitee against ONE session — the #63 counterpart to getLatestRsvpPaymentForInvitee. */
export async function getLatestSessionPaymentForInvitee(inviteeId: string, scheduleItemId: string): Promise<RsvpPaymentRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .select("*")
    .eq("invitee_id", inviteeId)
    .eq("schedule_item_id", scheduleItemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RsvpPaymentRow>();

  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  return data ? mapRow(data) : null;
}

interface RsvpPaymentWithInviteeRow extends RsvpPaymentRow {
  invitees: { name: string; phone: string | null; email: string | null } | null;
}

export interface RsvpPaymentQueueItem extends RsvpPaymentRecord {
  inviteeName: string;
  inviteePhone: string | null;
  inviteeEmail: string | null;
}

/** Every payment for one event, newest first — the admin RSVP Payments page. */
export async function listRsvpPaymentsForEvent(eventId: string): Promise<RsvpPaymentQueueItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .select("*, invitees(name, phone, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .returns<RsvpPaymentWithInviteeRow[]>();

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data.map((row) => ({
    ...mapRow(row),
    inviteeName: row.invitees?.name ?? "",
    inviteePhone: row.invitees?.phone ?? null,
    inviteeEmail: row.invitees?.email ?? null,
  }));
}

/** Every payment for ONE session, newest first — the #63 session-organizer's own "My Sessions" view (features/admin/session-organizers). */
export async function listRsvpPaymentsForScheduleItem(scheduleItemId: string): Promise<RsvpPaymentQueueItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .select("*, invitees(name, phone, email)")
    .eq("schedule_item_id", scheduleItemId)
    .order("created_at", { ascending: false })
    .returns<RsvpPaymentWithInviteeRow[]>();

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data.map((row) => ({
    ...mapRow(row),
    inviteeName: row.invitees?.name ?? "",
    inviteePhone: row.invitees?.phone ?? null,
    inviteeEmail: row.invitees?.email ?? null,
  }));
}

/** Gateway-verified success (Stripe session retrieve, Razorpay signature check, CCAvenue response decrypt) — idempotent, only advances a still-pending row. */
export async function markRsvpPaymentPaid(id: string, externalId?: string | null): Promise<RsvpPaymentRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .update({ status: "paid", external_id: externalId ?? null, paid_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle<RsvpPaymentRow>();

  if (error) throw new Error(`Failed to confirm payment: ${error.message}`);
  return data ? mapRow(data) : null;
}

export async function markRsvpPaymentFailed(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("rsvp_payments")
    .update({ status: "failed" })
    .eq("id", id)
    .eq("status", "pending");

  if (error) throw new Error(`Failed to update payment: ${error.message}`);
}

/** Guest attaches a reference note (UTR, transaction id, etc.) to their pending manual payment — doesn't change status, an admin still has to approve it. */
export async function attachRsvpPaymentReferenceNote(id: string, referenceNote: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("rsvp_payments")
    .update({ reference_note: referenceNote })
    .eq("id", id)
    .eq("status", "pending");

  if (error) throw new Error(`Failed to submit payment reference: ${error.message}`);
}

export async function approveRsvpPayment(id: string): Promise<RsvpPaymentRecord> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .update({ status: "paid", paid_at: new Date().toISOString(), reviewed_at: new Date().toISOString(), admin_note: null })
    .eq("id", id)
    .select("*")
    .single<RsvpPaymentRow>();

  if (error) throw new Error(`Failed to approve payment: ${error.message}`);
  return mapRow(data);
}

export async function rejectRsvpPayment(id: string, note?: string): Promise<RsvpPaymentRecord> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_payments")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), admin_note: note || null })
    .eq("id", id)
    .select("*")
    .single<RsvpPaymentRow>();

  if (error) throw new Error(`Failed to reject payment: ${error.message}`);
  return mapRow(data);
}
