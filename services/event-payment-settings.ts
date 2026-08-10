import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  EventPaymentSettingsInput,
  EventPaymentSettingsRecord,
  EventPaymentSettingsStatus,
} from "@/types/event-payment-settings";

interface EventPaymentSettingsRow {
  id: string;
  event_id: string;
  schedule_item_id: string | null;
  provider: EventPaymentSettingsRecord["provider"];
  bank_details: string | null;
  upi_id: string | null;
  stripe_secret_key: string | null;
  razorpay_key_id: string | null;
  razorpay_key_secret: string | null;
  ccavenue_merchant_id: string | null;
  ccavenue_access_code: string | null;
  ccavenue_working_key: string | null;
  currency: string;
  status: EventPaymentSettingsStatus;
  review_note: string | null;
  reviewed_at: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: EventPaymentSettingsRow): EventPaymentSettingsRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    scheduleItemId: row.schedule_item_id,
    provider: row.provider,
    bankDetails: row.bank_details,
    upiId: row.upi_id,
    stripeSecretKey: row.stripe_secret_key,
    razorpayKeyId: row.razorpay_key_id,
    razorpayKeySecret: row.razorpay_key_secret,
    ccavenueMerchantId: row.ccavenue_merchant_id,
    ccavenueAccessCode: row.ccavenue_access_code,
    ccavenueWorkingKey: row.ccavenue_working_key,
    currency: row.currency,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function maskSecret(value: string | null): string | null {
  if (!value) return value;
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

/** Masks every secret field — the shape returned to the client's own settings page after their first submission, and to the owner's review queue. Never leaks a full key back over the wire once saved. */
function maskRecord(record: EventPaymentSettingsRecord): EventPaymentSettingsRecord {
  return {
    ...record,
    stripeSecretKey: maskSecret(record.stripeSecretKey),
    razorpayKeySecret: maskSecret(record.razorpayKeySecret),
    ccavenueWorkingKey: maskSecret(record.ccavenueWorkingKey),
  };
}

/** Raw record, secrets un-masked — server-only use (e.g. building a checkout session in #62/#63). Never pass this to a client component. */
export async function getEventPaymentSettingsRaw(
  eventId: string,
  scheduleItemId: string | null = null,
): Promise<EventPaymentSettingsRecord | null> {
  let query = supabaseAdmin().from("event_payment_settings").select("*").eq("event_id", eventId);
  query = scheduleItemId ? query.eq("schedule_item_id", scheduleItemId) : query.is("schedule_item_id", null);

  const { data, error } = await query.maybeSingle<EventPaymentSettingsRow>();
  if (error) throw new Error(`Failed to load event payment settings: ${error.message}`);
  return data ? mapRow(data) : null;
}

/** Masked record for the client's own settings page — shows what's on file without re-exposing the raw secret. scheduleItemId set = the per-session override for one Event Day session (#63); null = the event's own default. */
export async function getEventPaymentSettingsSummary(
  eventId: string,
  scheduleItemId: string | null = null,
): Promise<EventPaymentSettingsRecord | null> {
  const record = await getEventPaymentSettingsRaw(eventId, scheduleItemId);
  return record ? maskRecord(record) : null;
}

/**
 * Creates or replaces this event's payment config — its own default
 * (scheduleItemId null) or a per-session override (#63, scheduleItemId
 * set) — always resetting status back to "pending_review", even on an
 * edit to an already-approved config, since the owner approved the
 * specific credentials that were on file, not "whatever this client
 * enters from now on." One row per event default is enforced by
 * event_payment_settings_event_default_uq (a partial unique index,
 * WHERE schedule_item_id IS NULL); per-session rows are uniqued by
 * schedule_item_id itself instead.
 */
export async function submitEventPaymentSettings(
  eventId: string,
  input: EventPaymentSettingsInput,
  submittedBy: string,
  scheduleItemId: string | null = null,
): Promise<EventPaymentSettingsRecord> {
  const patch: Record<string, unknown> = {
    event_id: eventId,
    schedule_item_id: scheduleItemId,
    provider: input.provider,
    status: "pending_review",
    review_note: null,
    reviewed_at: null,
    submitted_by: submittedBy,
    updated_at: new Date().toISOString(),
  };
  if (input.bankDetails !== undefined) patch.bank_details = input.bankDetails || null;
  if (input.upiId !== undefined) patch.upi_id = input.upiId || null;
  if (input.stripeSecretKey !== undefined) patch.stripe_secret_key = input.stripeSecretKey || null;
  if (input.razorpayKeyId !== undefined) patch.razorpay_key_id = input.razorpayKeyId || null;
  if (input.razorpayKeySecret !== undefined) patch.razorpay_key_secret = input.razorpayKeySecret || null;
  if (input.ccavenueMerchantId !== undefined) patch.ccavenue_merchant_id = input.ccavenueMerchantId || null;
  if (input.ccavenueAccessCode !== undefined) patch.ccavenue_access_code = input.ccavenueAccessCode || null;
  if (input.ccavenueWorkingKey !== undefined) patch.ccavenue_working_key = input.ccavenueWorkingKey || null;
  if (input.currency !== undefined) patch.currency = input.currency || "INR";

  // Explicit select-then-update-or-insert rather than .upsert(onConflict:
  // "event_id"/"schedule_item_id") — the event-default uniqueness
  // guarantee is a *partial* index (event_payment_settings_event_default_uq,
  // WHERE schedule_item_id IS NULL), and PostgREST's upsert can't target
  // a partial index via a bare column list. Same "read, then branch"
  // shape as services/payments.ts's getPaymentSettings().
  let existingQuery = supabaseAdmin().from("event_payment_settings").select("id").eq("event_id", eventId);
  existingQuery = scheduleItemId ? existingQuery.eq("schedule_item_id", scheduleItemId) : existingQuery.is("schedule_item_id", null);
  const existing = await existingQuery.maybeSingle<{ id: string }>();

  if (existing.error) throw new Error(`Failed to load payment settings: ${existing.error.message}`);

  const write = existing.data
    ? supabaseAdmin().from("event_payment_settings").update(patch).eq("id", existing.data.id)
    : supabaseAdmin().from("event_payment_settings").insert(patch);

  const { data, error } = await write.select("*").single<EventPaymentSettingsRow>();
  if (error) throw new Error(`Failed to save payment settings: ${error.message}`);
  return mapRow(data);
}

interface EventPaymentSettingsWithEventRow extends EventPaymentSettingsRow {
  events: { slug: string; honoree_name: string; event_title: string } | null;
  event_schedule_items: { title: string } | null;
}

export interface EventPaymentSettingsQueueItem extends EventPaymentSettingsRecord {
  eventSlug: string;
  eventHonoreeName: string;
  eventTitle: string;
  /** Set when this row is a per-session override (#63) rather than the event's own default. */
  sessionTitle: string | null;
}

/** Owner's review queue — every event's default config PLUS every per-session override (#63), newest submission first, optionally filtered by status. */
export async function listEventPaymentSettings(status?: EventPaymentSettingsStatus): Promise<EventPaymentSettingsQueueItem[]> {
  let query = supabaseAdmin()
    .from("event_payment_settings")
    .select("*, events(slug, honoree_name, event_title), event_schedule_items(title)")
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query.returns<EventPaymentSettingsWithEventRow[]>();
  if (error) throw new Error(`Failed to load payment settings queue: ${error.message}`);

  return (data ?? []).map((row) => ({
    ...maskRecord(mapRow(row)),
    eventSlug: row.events?.slug ?? "",
    eventHonoreeName: row.events?.honoree_name ?? "",
    eventTitle: row.events?.event_title ?? "",
    sessionTitle: row.event_schedule_items?.title ?? null,
  }));
}

export async function approveEventPaymentSettings(id: string): Promise<EventPaymentSettingsRecord> {
  const { data, error } = await supabaseAdmin()
    .from("event_payment_settings")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), review_note: null })
    .eq("id", id)
    .select("*")
    .single<EventPaymentSettingsRow>();

  if (error) throw new Error(`Failed to approve payment settings: ${error.message}`);
  return mapRow(data);
}

export async function rejectEventPaymentSettings(id: string, note?: string): Promise<EventPaymentSettingsRecord> {
  const { data, error } = await supabaseAdmin()
    .from("event_payment_settings")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), review_note: note || null })
    .eq("id", id)
    .select("*")
    .single<EventPaymentSettingsRow>();

  if (error) throw new Error(`Failed to reject payment settings: ${error.message}`);
  return mapRow(data);
}

/** Is this event's default config approved AND does it actually have usable credentials for its selected provider? Ready for #62 (RSVP payment step) to gate on. */
export async function isEventPaymentConfigured(eventId: string): Promise<boolean> {
  const settings = await getEventPaymentSettingsRaw(eventId);
  if (!settings || settings.status !== "approved") return false;

  switch (settings.provider) {
    case "manual":
      return Boolean(settings.bankDetails || settings.upiId);
    case "stripe":
      return Boolean(settings.stripeSecretKey);
    case "razorpay":
      return Boolean(settings.razorpayKeyId && settings.razorpayKeySecret);
    case "ccavenue":
      return Boolean(settings.ccavenueMerchantId && settings.ccavenueAccessCode && settings.ccavenueWorkingKey);
    default:
      return false;
  }
}
