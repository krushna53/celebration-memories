import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEventById } from "@/services/events";
import { graphConfig, whatsappEnvStatus } from "@/lib/whatsapp-cloud/config";
import { graphRequest, MAX_SEND_ATTEMPTS, retryDelayMs, sendGraphMessage } from "@/lib/whatsapp-cloud/client";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-cloud/phone";
import { eventTemplateValues, valuesFor } from "@/lib/whatsapp-cloud/event-messages";
import {
  buildDocumentPayload,
  buildImagePayload,
  buildTemplatePayload,
  buildTextPayload,
  toGraphBody,
  type BuildResult,
} from "@/lib/whatsapp-cloud/payloads";
import {
  automationAudience,
  consentDecision,
  dueAutomations,
  parseOptKeyword,
  shouldApplyStatus,
  withinServiceWindow,
  type ConsentState,
  type ContactState,
} from "@/lib/whatsapp-cloud/policy";
import {
  isWhatsAppCategory,
  WHATSAPP_STATUSES,
  type EventWhatsAppSettings,
  type WhatsAppCategory,
  type WhatsAppLogFilters,
  type WhatsAppMessageLog,
  type WhatsAppMessageStatus,
  type WhatsAppMessageType,
  type WhatsAppOutgoingPayload,
  type WhatsAppPlatformSettings,
  type WhatsAppStatusCounts,
  type WhatsAppTemplateMap,
  type WhatsAppWebhookEvent,
} from "@/lib/whatsapp-cloud/types";
import type { EventRecord } from "@/types/event";

/**
 * WhatsApp Cloud API service — the one place that sends, so every send
 * goes through the same checks (docs/WHATSAPP_INTEGRATION.md):
 *
 *   1. integration switched on (WHATSAPP_ENABLED env + the owner's switch)
 *   2. test mode → only the owner's verified test recipients
 *   3. valid phone, not globally opted out, consent on record for the
 *      category (consentDecision), free-form text only inside the 24h window
 *   4. one whatsapp_messages row per idempotency key — a second call with
 *      the same key is a no-op, so retries/cron overlaps never double-send
 *
 * whatsapp_messages is both the log and the outbox: a row is queued, then
 * delivered inline (deliverNow) or by the 15-minute cron; transient Graph
 * errors back off and retry up to MAX_SEND_ATTEMPTS, permanent ones fail
 * immediately.
 */

export type ServiceResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export interface SendOutcome {
  id: string | null;
  status: WhatsAppMessageStatus | "duplicate" | "blocked";
  reason?: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

interface PlatformRow {
  enabled: boolean;
  templates: WhatsAppTemplateMap | null;
  test_recipients: string[] | null;
  updated_at: string | null;
}

export async function getWhatsAppPlatformSettings(): Promise<WhatsAppPlatformSettings> {
  const { data } = await supabaseAdmin().from("whatsapp_settings").select("enabled, templates, test_recipients, updated_at").eq("id", 1).maybeSingle<PlatformRow>();
  return {
    enabled: data?.enabled ?? false,
    templates: data?.templates ?? {},
    testRecipients: data?.test_recipients ?? [],
    updatedAt: data?.updated_at ?? null,
  };
}

export async function updateWhatsAppPlatformSettings(
  adminId: string,
  patch: { enabled?: boolean; templates?: WhatsAppTemplateMap; testRecipients?: string[] },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("whatsapp_settings")
    .upsert({
      id: 1,
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.templates !== undefined ? { templates: patch.templates } : {}),
      ...(patch.testRecipients !== undefined ? { test_recipients: patch.testRecipients } : {}),
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`Failed to save WhatsApp settings: ${error.message}`);
  await audit(adminId, null, "platform_settings_updated", { fields: Object.keys(patch) });
}

interface EventSettingsRow {
  event_id: string;
  enabled: boolean;
  rsvp_confirmation: boolean;
  reminder_24h: boolean;
  reminder_2h: boolean;
  thank_you: boolean;
  memory_reminder: boolean;
  feedback_request: boolean;
}

function mapEventSettings(row: EventSettingsRow): EventWhatsAppSettings {
  return {
    eventId: row.event_id,
    enabled: row.enabled,
    rsvpConfirmation: row.rsvp_confirmation,
    reminder24h: row.reminder_24h,
    reminder2h: row.reminder_2h,
    thankYou: row.thank_you,
    memoryReminder: row.memory_reminder,
    feedbackRequest: row.feedback_request,
  };
}

/** Defaults mirror the table's column defaults — off until the host turns it on. */
export function defaultEventWhatsAppSettings(eventId: string): EventWhatsAppSettings {
  return { eventId, enabled: false, rsvpConfirmation: true, reminder24h: true, reminder2h: false, thankYou: true, memoryReminder: false, feedbackRequest: false };
}

export async function getEventWhatsAppSettings(eventId: string): Promise<EventWhatsAppSettings> {
  const { data } = await supabaseAdmin().from("event_whatsapp_settings").select("*").eq("event_id", eventId).maybeSingle<EventSettingsRow>();
  return data ? mapEventSettings(data) : defaultEventWhatsAppSettings(eventId);
}

export async function updateEventWhatsAppSettings(adminId: string, settings: EventWhatsAppSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("event_whatsapp_settings").upsert({
    event_id: settings.eventId,
    enabled: settings.enabled,
    rsvp_confirmation: settings.rsvpConfirmation,
    reminder_24h: settings.reminder24h,
    reminder_2h: settings.reminder2h,
    thank_you: settings.thankYou,
    memory_reminder: settings.memoryReminder,
    feedback_request: settings.feedbackRequest,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to save event WhatsApp settings: ${error.message}`);
  await audit(adminId, settings.eventId, "event_settings_updated", { ...settings });
}

/** Whether a real send can happen at all right now (env switch, credentials, owner switch). */
export async function whatsappSendingAvailable(): Promise<boolean> {
  if (!whatsappEnvStatus().enabled || !graphConfig()) return false;
  return (await getWhatsAppPlatformSettings()).enabled;
}

async function audit(adminId: string | null, eventId: string | null, action: string, details: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin().from("whatsapp_audit_log").insert({ admin_id: adminId, event_id: eventId, action, details });
  if (error) console.error("whatsapp audit log insert failed:", error.message);
}

// ─── Consent ─────────────────────────────────────────────────────────────────

export type ConsentSource = "rsvp_form" | "public_rsvp_form" | "host_attested";

async function getConsentState(inviteeId: string | null | undefined): Promise<ConsentState | null> {
  if (!inviteeId) return null;
  const { data } = await supabaseAdmin()
    .from("whatsapp_consents")
    .select("opted_in, opted_out_at, marketing_opted_in")
    .eq("invitee_id", inviteeId)
    .maybeSingle<{ opted_in: boolean; opted_out_at: string | null; marketing_opted_in: boolean }>();
  return data ? { optedIn: data.opted_in, optedOutAt: data.opted_out_at, marketingOptedIn: data.marketing_opted_in } : null;
}

async function getContactState(phone: string): Promise<ContactState | null> {
  const { data } = await supabaseAdmin()
    .from("whatsapp_contacts")
    .select("opted_out_at, last_inbound_at")
    .eq("phone", phone)
    .maybeSingle<{ opted_out_at: string | null; last_inbound_at: string | null }>();
  return data ? { optedOutAt: data.opted_out_at, lastInboundAt: data.last_inbound_at } : null;
}

/** Whether a guest has ticked the box before — prefills the RSVP form's checkbox. */
export async function hasWhatsAppConsent(inviteeId: string): Promise<boolean> {
  const consent = await getConsentState(inviteeId);
  return Boolean(consent?.optedIn && !consent.optedOutAt);
}

/**
 * Records the RSVP form's opt-in checkbox. Ticking it opts in (and clears
 * an earlier per-event opt-out); unticking it withdraws consent. A phone
 * that doesn't normalise can't be messaged anyway, so it's not stored.
 */
export async function recordWhatsAppConsent(input: {
  inviteeId: string;
  eventId: string;
  phone: string | null | undefined;
  optIn: boolean;
  source: ConsentSource;
}): Promise<void> {
  const now = new Date().toISOString();
  if (!input.optIn) {
    await supabaseAdmin().from("whatsapp_consents").update({ opted_in: false, updated_at: now }).eq("invitee_id", input.inviteeId);
    return;
  }
  const phone = normalizeWhatsAppPhone(input.phone, whatsappEnvStatus().defaultCountryCode);
  if (!phone.ok) return;
  const { error } = await supabaseAdmin().from("whatsapp_consents").upsert({
    invitee_id: input.inviteeId,
    event_id: input.eventId,
    phone: phone.phone,
    opted_in: true,
    consent_at: now,
    consent_source: input.source,
    opted_out_at: null,
    updated_at: now,
  });
  if (error) throw new Error(`Failed to save WhatsApp consent: ${error.message}`);
}

/**
 * A host confirming that these guests agreed to WhatsApp messages (e.g.
 * they asked to be invited this way). Only guests of this event with a
 * valid phone are recorded; returns how many were.
 */
export async function attestWhatsAppConsent(adminId: string, eventId: string, inviteeIds: string[]): Promise<number> {
  if (inviteeIds.length === 0) return 0;
  const { data: invitees, error } = await supabaseAdmin().from("invitees").select("id, phone").eq("event_id", eventId).in("id", inviteeIds);
  if (error) throw new Error(`Failed to load guests: ${error.message}`);
  const cc = whatsappEnvStatus().defaultCountryCode;
  const now = new Date().toISOString();
  const rows = (invitees ?? []).flatMap((inv: { id: string; phone: string | null }) => {
    const phone = normalizeWhatsAppPhone(inv.phone, cc);
    return phone.ok
      ? [{ invitee_id: inv.id, event_id: eventId, phone: phone.phone, opted_in: true, consent_at: now, consent_source: "host_attested", opted_out_at: null, updated_at: now }]
      : [];
  });
  if (rows.length > 0) {
    const { error: upsertError } = await supabaseAdmin().from("whatsapp_consents").upsert(rows);
    if (upsertError) throw new Error(`Failed to save consent: ${upsertError.message}`);
  }
  await audit(adminId, eventId, "consent_attested", { inviteeIds: rows.map((r) => r.invitee_id) });
  return rows.length;
}

export async function revokeWhatsAppConsent(adminId: string, eventId: string, inviteeIds: string[]): Promise<void> {
  if (inviteeIds.length === 0) return;
  const { error } = await supabaseAdmin()
    .from("whatsapp_consents")
    .update({ opted_in: false, updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .in("invitee_id", inviteeIds);
  if (error) throw new Error(`Failed to update consent: ${error.message}`);
  await audit(adminId, eventId, "consent_revoked", { inviteeIds });
}

export interface WhatsAppGuestRow {
  inviteeId: string;
  name: string;
  phone: string | null;
  phoneValid: boolean;
  rsvpStatus: string;
  consent: "opted_in" | "opted_out" | "none";
  consentSource: string | null;
  invited: boolean;
}

/** Every guest of an event with their WhatsApp consent state — for the host's WhatsApp page. */
export async function listWhatsAppGuests(eventId: string): Promise<WhatsAppGuestRow[]> {
  const client = supabaseAdmin();
  const [{ data: invitees }, { data: consents }, { data: invited }] = await Promise.all([
    client.from("invitees").select("id, name, phone, rsvp_status").eq("event_id", eventId).order("name"),
    client.from("whatsapp_consents").select("invitee_id, phone, opted_in, opted_out_at, consent_source").eq("event_id", eventId),
    client.from("whatsapp_messages").select("invitee_id").eq("event_id", eventId).eq("category", "invitation").neq("status", "failed"),
  ]);
  const consentBy = new Map(
    (consents ?? []).map((c: { invitee_id: string; phone: string; opted_in: boolean; opted_out_at: string | null; consent_source: string | null }) => [c.invitee_id, c]),
  );
  const invitedSet = new Set((invited ?? []).map((m: { invitee_id: string | null }) => m.invitee_id));
  const optedOutPhones = await globallyOptedOut((consents ?? []).map((c: { phone: string }) => c.phone));
  const cc = whatsappEnvStatus().defaultCountryCode;

  return (invitees ?? []).map((inv: { id: string; name: string; phone: string | null; rsvp_status: string }) => {
    const c = consentBy.get(inv.id);
    const optedOut = Boolean(c && (c.opted_out_at || optedOutPhones.has(c.phone)));
    return {
      inviteeId: inv.id,
      name: inv.name,
      phone: inv.phone,
      phoneValid: normalizeWhatsAppPhone(inv.phone, cc).ok,
      rsvpStatus: inv.rsvp_status,
      consent: optedOut ? "opted_out" : c?.opted_in ? "opted_in" : "none",
      consentSource: c?.consent_source ?? null,
      invited: invitedSet.has(inv.id),
    };
  });
}

async function globallyOptedOut(phones: string[]): Promise<Set<string>> {
  if (phones.length === 0) return new Set();
  const { data } = await supabaseAdmin().from("whatsapp_contacts").select("phone").in("phone", phones).not("opted_out_at", "is", null);
  return new Set((data ?? []).map((r: { phone: string }) => r.phone));
}

// ─── Sending ─────────────────────────────────────────────────────────────────

export interface SendInput {
  idempotencyKey: string;
  category: WhatsAppCategory;
  phone: string;
  build: BuildResult;
  eventId?: string | null;
  inviteeId?: string | null;
  adminId?: string | null;
  /** Deliver in this request (default) or leave it queued for the outbox. */
  deliverNow?: boolean;
}

/** The single gate every send goes through — see the header comment. */
export async function sendWhatsAppMessage(input: SendInput): Promise<ServiceResult<SendOutcome>> {
  const env = whatsappEnvStatus();
  if (!env.enabled || !graphConfig()) return { success: false, error: "WhatsApp isn't configured on this server." };
  const settings = await getWhatsAppPlatformSettings();
  if (!settings.enabled) return { success: false, error: "WhatsApp messaging is switched off in /admin/whatsapp." };
  if (!input.build.ok) return { success: false, error: input.build.error };

  const phone = normalizeWhatsAppPhone(input.phone, env.defaultCountryCode);
  if (!phone.ok) return { success: false, error: phone.error };

  if (env.testMode && !settings.testRecipients.includes(phone.phone)) {
    return { success: true, data: { id: null, status: "blocked", reason: "Test mode — only verified test recipients receive messages." } };
  }

  const contact = await getContactState(phone.phone);
  const decision = consentDecision(input.category, await getConsentState(input.inviteeId), contact);
  if (!decision.ok) return { success: true, data: { id: null, status: "blocked", reason: decision.reason } };

  const payload = input.build.payload;
  if (payload.type !== "template" && !withinServiceWindow(contact?.lastInboundAt ?? null, new Date())) {
    return {
      success: false,
      error: "Free-form messages can only be sent within 24 hours of the person's last message to us — use an approved template.",
    };
  }

  const { data: inserted, error } = await supabaseAdmin()
    .from("whatsapp_messages")
    .upsert(
      {
        idempotency_key: input.idempotencyKey,
        event_id: input.eventId ?? null,
        invitee_id: input.inviteeId ?? null,
        admin_id: input.adminId ?? null,
        recipient_phone: phone.phone,
        message_type: payload.type satisfies WhatsAppMessageType,
        template_name: payload.type === "template" ? payload.template.name : null,
        category: input.category,
        payload,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { success: false, error: `Couldn't queue the message: ${error.message}` };
  const id = (inserted as Array<{ id: string }> | null)?.[0]?.id;
  if (!id) return { success: true, data: { id: null, status: "duplicate" } };

  if (input.deliverNow === false) return { success: true, data: { id, status: "queued" } };
  const status = await deliverQueuedMessage(id);
  return { success: true, data: { id, status } };
}

export function sendWhatsAppText(input: Omit<SendInput, "build"> & { body: string }) {
  return sendWhatsAppMessage({ ...input, build: buildTextPayload(input.body) });
}

export function sendWhatsAppTemplate(input: Omit<SendInput, "build"> & { values: Record<string, string>; templates?: WhatsAppTemplateMap }) {
  return sendWhatsAppMessage({ ...input, build: buildTemplatePayload(input.category, input.values, input.templates) });
}

export function sendWhatsAppImage(input: Omit<SendInput, "build"> & { link: string; caption?: string }) {
  return sendWhatsAppMessage({ ...input, build: buildImagePayload(input.link, input.caption) });
}

export function sendWhatsAppDocument(input: Omit<SendInput, "build"> & { link: string; filename?: string; caption?: string }) {
  return sendWhatsAppMessage({ ...input, build: buildDocumentPayload(input.link, input.filename, input.caption) });
}

interface QueuedRow {
  id: string;
  recipient_phone: string;
  payload: WhatsAppOutgoingPayload;
  attempts: number;
}

/**
 * Sends one queued row. Claims it first (queued → sending, attempts+1)
 * so two workers can never send the same row.
 */
export async function deliverQueuedMessage(id: string): Promise<WhatsAppMessageStatus> {
  const client = supabaseAdmin();
  const { data: current } = await client.from("whatsapp_messages").select("id, recipient_phone, payload, attempts, status").eq("id", id).maybeSingle<QueuedRow & { status: WhatsAppMessageStatus }>();
  if (!current || current.status !== "queued") return current?.status ?? "failed";

  const { data: claimed } = await client
    .from("whatsapp_messages")
    .update({ status: "sending", attempts: current.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued")
    .eq("attempts", current.attempts)
    .select("id");
  if (!claimed || claimed.length === 0) return "sending";

  const attempts = current.attempts + 1;
  const config = graphConfig();
  const result = config
    ? await sendGraphMessage(config, toGraphBody(current.recipient_phone, current.payload))
    : ({ ok: false, retryable: true, code: null, title: "WhatsApp credentials missing." } as const);
  const now = new Date();

  if (result.ok) {
    await client.from("whatsapp_messages").update({ status: "accepted", wamid: result.wamid, error_code: null, error_title: null, updated_at: now.toISOString() }).eq("id", id);
    await reconcileEarlyStatuses(result.wamid);
    return "accepted";
  }

  if (result.retryable && attempts < MAX_SEND_ATTEMPTS) {
    await client
      .from("whatsapp_messages")
      .update({
        status: "queued",
        next_attempt_at: new Date(now.getTime() + retryDelayMs(attempts)).toISOString(),
        error_code: result.code,
        error_title: result.title,
        updated_at: now.toISOString(),
      })
      .eq("id", id);
    return "queued";
  }

  await client
    .from("whatsapp_messages")
    .update({ status: "failed", failed_at: now.toISOString(), error_code: result.code, error_title: result.title, updated_at: now.toISOString() })
    .eq("id", id);
  return "failed";
}

/** A status webhook can beat our own write of the wamid — re-apply any that arrived first. */
async function reconcileEarlyStatuses(wamid: string): Promise<void> {
  const { data } = await supabaseAdmin().from("whatsapp_webhook_events").select("payload").eq("kind", "status").eq("wamid", wamid);
  for (const row of (data ?? []) as Array<{ payload: { status?: string; timestamp?: string; errors?: Array<{ code: number; title: string }> } }>) {
    const status = row.payload.status;
    if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
      await applyStatus(wamid, status, row.payload.timestamp ?? new Date().toISOString(), row.payload.errors ?? []);
    }
  }
}

/**
 * Drains due queued rows (optionally one event's), oldest first, within a
 * time budget so a Server Action / cron request stays under Netlify's
 * function limit. Rows stuck in "sending" (a crash mid-request) are
 * failed rather than retried: Meta has no idempotency key, so a retry
 * could double-send a message that actually went out.
 */
export async function processWhatsAppOutbox(options: { eventId?: string; limit?: number; budgetMs?: number } = {}): Promise<{ processed: number; remaining: number }> {
  const client = supabaseAdmin();
  const started = Date.now();
  const staleBefore = new Date(started - 10 * 60 * 1000).toISOString();
  await client
    .from("whatsapp_messages")
    .update({ status: "failed", failed_at: new Date().toISOString(), error_title: "Interrupted while sending — not retried, to avoid a duplicate." })
    .eq("status", "sending")
    .lt("updated_at", staleBefore);

  let query = client
    .from("whatsapp_messages")
    .select("id")
    .eq("status", "queued")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(options.limit ?? 50);
  if (options.eventId) query = query.eq("event_id", options.eventId);
  const { data } = await query;
  const ids = (data ?? []).map((r: { id: string }) => r.id);

  let processed = 0;
  for (const id of ids) {
    if (Date.now() - started > (options.budgetMs ?? 7000)) break;
    await deliverQueuedMessage(id);
    processed += 1;
  }

  let remainingQuery = client.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "queued");
  if (options.eventId) remainingQuery = remainingQuery.eq("event_id", options.eventId);
  const { count } = await remainingQuery;
  return { processed, remaining: count ?? 0 };
}

// ─── EveryMoment event notifications ─────────────────────────────────────────

interface InviteeRow {
  id: string;
  name: string;
  token: string;
  phone: string | null;
  rsvp_status: string;
  checked_in: boolean;
}

/**
 * Sends one event notification to one guest of that event. The invitee
 * is re-read here (never trusted from the caller) and must belong to
 * `eventId`, so a link in the message can only ever be that guest's own.
 */
export async function sendWhatsAppNotification(input: {
  category: WhatsAppCategory;
  eventId: string;
  inviteeId: string;
  idempotencyKey: string;
  adminId?: string | null;
  deliverNow?: boolean;
  event?: EventRecord;
  templates?: WhatsAppTemplateMap;
}): Promise<ServiceResult<SendOutcome>> {
  const event = input.event ?? (await getEventById(input.eventId));
  if (!event || event.id !== input.eventId) return { success: false, error: "Event not found." };
  const { data: invitee } = await supabaseAdmin()
    .from("invitees")
    .select("id, name, token, phone, rsvp_status, checked_in")
    .eq("id", input.inviteeId)
    .eq("event_id", input.eventId)
    .maybeSingle<InviteeRow>();
  if (!invitee?.phone) return { success: false, error: "Guest has no phone number." };

  const templates = input.templates ?? (await getWhatsAppPlatformSettings()).templates;
  return sendWhatsAppMessage({
    idempotencyKey: input.idempotencyKey,
    category: input.category,
    phone: invitee.phone,
    build: buildTemplatePayload(input.category, valuesFor(input.category, eventTemplateValues(event, invitee)), templates),
    eventId: event.id,
    inviteeId: invitee.id,
    adminId: input.adminId ?? null,
    deliverNow: input.deliverNow,
  });
}

/**
 * RSVP confirmation, called (best-effort) after an RSVP is saved. One per
 * guest per answer — changing "Maybe" to "Attending" confirms again,
 * re-submitting the same answer doesn't.
 */
export async function notifyRsvpConfirmationWhatsApp(eventId: string, inviteeId: string, coming: string): Promise<void> {
  const settings = await getEventWhatsAppSettings(eventId);
  if (!settings.enabled || !settings.rsvpConfirmation) return;
  if (!(await whatsappSendingAvailable())) return;
  const result = await sendWhatsAppNotification({ category: "rsvp_confirmation", eventId, inviteeId, idempotencyKey: `rsvp_confirmation:${inviteeId}:${coming}` });
  if (!result.success) console.error("RSVP WhatsApp confirmation not sent:", result.error);
}

/**
 * Everything WhatsApp after an RSVP form is saved: record the opt-in
 * checkbox (only shown — so only honoured — when the event has WhatsApp
 * on), then send the confirmation if they're opted in.
 */
export async function recordRsvpWhatsApp(input: {
  eventId: string;
  inviteeId: string;
  phone: string | undefined;
  optIn: boolean | undefined;
  source: ConsentSource;
  coming: string;
}): Promise<void> {
  const settings = await getEventWhatsAppSettings(input.eventId);
  if (!settings.enabled || input.optIn === undefined) return;
  await recordWhatsAppConsent({ inviteeId: input.inviteeId, eventId: input.eventId, phone: input.phone, optIn: input.optIn, source: input.source });
  if (input.optIn) await notifyRsvpConfirmationWhatsApp(input.eventId, input.inviteeId, input.coming);
}

/**
 * Queues the invitation template for this event's guests who have
 * consent and haven't already been sent one (the idempotency key is per
 * guest, so pressing the button twice is safe). Only queues — the admin
 * page then drains the outbox in batches and the cron picks up the rest.
 */
export async function queueEventInvitations(
  adminId: string,
  eventId: string,
  inviteeIds: string[] | null,
): Promise<{ queued: number; duplicate: number; blocked: number; failed: number }> {
  const event = await getEventById(eventId);
  if (!event) throw new Error("Event not found.");
  const settings = await getEventWhatsAppSettings(eventId);
  if (!settings.enabled) throw new Error("Turn on WhatsApp for this event first.");

  const guests = (await listWhatsAppGuests(eventId)).filter(
    (g) => g.consent === "opted_in" && g.phoneValid && (!inviteeIds || inviteeIds.includes(g.inviteeId)),
  );
  const templates = (await getWhatsAppPlatformSettings()).templates;
  const counts = { queued: 0, duplicate: 0, blocked: 0, failed: 0 };
  for (const guest of guests.slice(0, 1000)) {
    const result = await sendWhatsAppNotification({
      category: "invitation",
      eventId,
      inviteeId: guest.inviteeId,
      idempotencyKey: `invitation:${guest.inviteeId}`,
      adminId,
      deliverNow: false,
      event,
      templates,
    });
    if (!result.success) counts.failed += 1;
    else if (result.data.status === "queued") counts.queued += 1;
    else if (result.data.status === "duplicate") counts.duplicate += 1;
    else counts.blocked += 1;
  }
  await audit(adminId, eventId, "invitations_queued", counts);
  return counts;
}

/** The test send from /admin/whatsapp — verified test recipients only, capped per hour. */
export async function sendWhatsAppTestMessage(adminId: string, phoneInput: string, body: string | null): Promise<ServiceResult<SendOutcome>> {
  const settings = await getWhatsAppPlatformSettings();
  const phone = normalizeWhatsAppPhone(phoneInput, whatsappEnvStatus().defaultCountryCode);
  if (!phone.ok) return { success: false, error: phone.error };
  if (!settings.testRecipients.includes(phone.phone)) return { success: false, error: "Add this number as a test recipient first." };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin().from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("category", "test").gte("created_at", hourAgo);
  if ((count ?? 0) >= 10) return { success: false, error: "Test limit reached (10 an hour). Try again later." };

  const result = await sendWhatsAppMessage({
    idempotencyKey: `test:${adminId}:${Date.now()}`,
    category: "test",
    phone: phone.phone,
    build: body ? buildTextPayload(body) : buildTemplatePayload("test", {}, settings.templates),
    adminId,
  });
  await audit(adminId, null, "test_message_sent", { phone: phone.phone, freeForm: Boolean(body), ok: result.success });
  return result;
}

/**
 * The 15-minute cron's job: queue every due reminder / post-event message
 * (dueAutomations decides which; one per guest per category, ever), then
 * drain the outbox.
 */
export async function runWhatsAppAutomations(now = new Date()): Promise<{ queued: number; processed: number; remaining: number }> {
  let queued = 0;
  if (await whatsappSendingAvailable()) {
    const { data: rows } = await supabaseAdmin().from("event_whatsapp_settings").select("*").eq("enabled", true);
    const templates = (await getWhatsAppPlatformSettings()).templates;
    for (const row of (rows ?? []) as EventSettingsRow[]) {
      const settings = mapEventSettings(row);
      const event = await getEventById(settings.eventId);
      if (!event) continue;
      const due = dueAutomations(settings, event.startAt, event.endAt, now);
      if (due.length === 0) continue;

      const { data: consents } = await supabaseAdmin().from("whatsapp_consents").select("invitee_id").eq("event_id", event.id).eq("opted_in", true).is("opted_out_at", null);
      const consentIds = (consents ?? []).map((c: { invitee_id: string }) => c.invitee_id);
      if (consentIds.length === 0) continue;
      const { data: invitees } = await supabaseAdmin().from("invitees").select("id, name, token, phone, rsvp_status, checked_in").eq("event_id", event.id).in("id", consentIds);
      const uploaders = due.includes("memory_reminder") ? await inviteesWithUploads(event.id) : new Set<string>();

      for (const category of due) {
        for (const invitee of (invitees ?? []) as InviteeRow[]) {
          if (!automationAudience(category, invitee.rsvp_status, invitee.checked_in)) continue;
          if (category === "memory_reminder" && uploaders.has(invitee.id)) continue;
          const result = await sendWhatsAppNotification({
            category,
            eventId: event.id,
            inviteeId: invitee.id,
            idempotencyKey: `${category}:${invitee.id}`,
            deliverNow: false,
            event,
            templates,
          });
          if (result.success && result.data.status === "queued") queued += 1;
        }
      }
    }
  }
  const outbox = await processWhatsAppOutbox({ limit: 100, budgetMs: 8000 });
  await purgeOldWhatsAppData();
  return { queued, ...outbox };
}

async function inviteesWithUploads(eventId: string): Promise<Set<string>> {
  const client = supabaseAdmin();
  const results = await Promise.all(["photos", "videos", "audio"].map((table) => client.from(table).select("invitee_id").eq("event_id", eventId)));
  return new Set(results.flatMap((r) => (r.data ?? []).map((row: { invitee_id: string | null }) => row.invitee_id ?? "")));
}

/** Retention: raw webhook bodies (which include inbound message text) go after 90 days; message bodies are redacted after 180. */
async function purgeOldWhatsAppData(): Promise<void> {
  const client = supabaseAdmin();
  const day = 24 * 60 * 60 * 1000;
  await client.from("whatsapp_webhook_events").delete().lt("received_at", new Date(Date.now() - 90 * day).toISOString());
  await client
    .from("whatsapp_messages")
    .update({ payload: { redacted: true } })
    .lt("created_at", new Date(Date.now() - 180 * day).toISOString())
    .not("payload", "cs", JSON.stringify({ redacted: true }));
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

const STATUS_COLUMN = { sent: "sent_at", delivered: "delivered_at", read: "read_at", failed: "failed_at" } as const;

async function applyStatus(wamid: string, status: "sent" | "delivered" | "read" | "failed", timestamp: string, errors: Array<{ code: number; title: string }>): Promise<void> {
  const client = supabaseAdmin();
  const { data: message } = await client.from("whatsapp_messages").select("id, status").eq("wamid", wamid).maybeSingle<{ id: string; status: WhatsAppMessageStatus }>();
  if (!message) return;
  const update: Record<string, unknown> = { [STATUS_COLUMN[status]]: timestamp, updated_at: new Date().toISOString() };
  if (shouldApplyStatus(message.status, status)) update.status = status;
  const firstError = errors[0];
  if (status === "failed" && firstError) {
    update.error_code = firstError.code;
    update.error_title = firstError.title;
  }
  await client.from("whatsapp_messages").update(update).eq("id", message.id);
}

async function applyInbound(fromPhone: string, timestamp: string, text: string | null): Promise<void> {
  const client = supabaseAdmin();
  const now = new Date().toISOString();
  const keyword = parseOptKeyword(text);
  await client.from("whatsapp_contacts").upsert({
    phone: fromPhone,
    last_inbound_at: timestamp,
    ...(keyword === "stop" ? { opted_out_at: now, opt_out_source: "whatsapp_reply" } : {}),
    ...(keyword === "start" ? { opted_out_at: null, opt_out_source: null } : {}),
    updated_at: now,
  });
  if (keyword === "stop") {
    await client.from("whatsapp_consents").update({ opted_out_at: now, updated_at: now }).eq("phone", fromPhone);
  }
}

/**
 * Stores and applies a verified webhook batch. Each event is inserted
 * with ON CONFLICT DO NOTHING on its dedupe key and only applied if it
 * was new, so Meta re-delivering the same notification changes nothing.
 */
export async function ingestWhatsAppWebhook(events: WhatsAppWebhookEvent[]): Promise<{ applied: number; duplicates: number }> {
  let applied = 0;
  let duplicates = 0;
  for (const ev of events) {
    const row = {
      dedupe_key: ev.dedupeKey,
      kind: ev.kind,
      wamid: ev.kind === "error" ? null : ev.wamid,
      from_phone: ev.kind === "message" ? ev.fromPhone : null,
      payload:
        ev.kind === "status"
          ? { status: ev.status, timestamp: ev.timestamp, errors: ev.errors, recipient: ev.recipientPhone }
          : ev.kind === "message"
            ? { type: ev.messageType, timestamp: ev.timestamp, text: ev.text?.slice(0, 1000) ?? null }
            : { errors: ev.errors },
    };
    const { data, error } = await supabaseAdmin().from("whatsapp_webhook_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(`Failed to store webhook event: ${error.message}`);
    if (!data || data.length === 0) {
      duplicates += 1;
      continue;
    }
    if (ev.kind === "status") await applyStatus(ev.wamid, ev.status, ev.timestamp, ev.errors);
    else if (ev.kind === "message") await applyInbound(ev.fromPhone, ev.timestamp, ev.text);
    else console.error("WhatsApp webhook reported errors:", ev.errors.map((e) => `${e.code} ${e.title}`).join("; "));
    applied += 1;
  }
  return { applied, duplicates };
}

// ─── Stats, logs, health ─────────────────────────────────────────────────────

/** Which messages a page may see: one event's, or the owner's platform view (only test sends + events the owner itself owns). */
export type WhatsAppLogScope = { eventId: string } | { platform: true; ownedEventIds: string[] };

function applyFilters<Q extends { eq: (c: string, v: string) => Q; gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q; or: (f: string) => Q }>(
  query: Q,
  filters: WhatsAppLogFilters,
  scope: WhatsAppLogScope,
): Q {
  let q = query;
  if ("eventId" in scope) q = q.eq("event_id", scope.eventId);
  else if (filters.eventId && scope.ownedEventIds.includes(filters.eventId)) q = q.eq("event_id", filters.eventId);
  else {
    q = q.or(scope.ownedEventIds.length > 0 ? `category.eq.test,event_id.in.(${scope.ownedEventIds.join(",")})` : "category.eq.test");
  }
  if (filters.from) q = q.gte("created_at", new Date(filters.from).toISOString());
  if (filters.to) q = q.lte("created_at", new Date(`${filters.to}T23:59:59.999Z`).toISOString());
  if (filters.category && isWhatsAppCategory(filters.category)) q = q.eq("category", filters.category);
  if (filters.status) q = q.eq("status", filters.status);
  return q;
}

/**
 * Status counts. On the platform view these are aggregate numbers across
 * every event (no recipients or content), which is why they aren't
 * restricted the way the message list is.
 */
export async function getWhatsAppStatusCounts(filters: WhatsAppLogFilters, scope: WhatsAppLogScope): Promise<WhatsAppStatusCounts> {
  const eventId = "eventId" in scope ? scope.eventId : filters.eventId && scope.ownedEventIds.includes(filters.eventId) ? filters.eventId : null;
  const { data, error } = await supabaseAdmin().rpc("whatsapp_status_counts", {
    p_event_id: eventId,
    p_from: filters.from ? new Date(filters.from).toISOString() : null,
    p_to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`).toISOString() : null,
    p_category: filters.category && isWhatsAppCategory(filters.category) ? filters.category : null,
    p_status: filters.status ?? null,
  });
  if (error) throw new Error(`Failed to count WhatsApp messages: ${error.message}`);
  const counts = Object.fromEntries(WHATSAPP_STATUSES.map((s) => [s, 0])) as Record<WhatsAppMessageStatus, number>;
  for (const row of (data ?? []) as Array<{ status: string; n: number | string }>) {
    if ((WHATSAPP_STATUSES as readonly string[]).includes(row.status)) counts[row.status as WhatsAppMessageStatus] = Number(row.n);
  }
  return { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

interface MessageLogRow {
  id: string;
  event_id: string | null;
  recipient_phone: string;
  message_type: WhatsAppMessageType;
  template_name: string | null;
  category: string;
  status: WhatsAppMessageStatus;
  attempts: number;
  error_code: number | null;
  error_title: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  events: { honoree_name: string } | null;
  invitees: { name: string } | null;
}

export async function listWhatsAppMessages(filters: WhatsAppLogFilters, scope: WhatsAppLogScope, limit = 100): Promise<WhatsAppMessageLog[]> {
  const query = supabaseAdmin()
    .from("whatsapp_messages")
    .select(
      "id, event_id, recipient_phone, message_type, template_name, category, status, attempts, error_code, error_title, created_at, sent_at, delivered_at, read_at, failed_at, events(honoree_name), invitees(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data, error } = await applyFilters(query, filters, scope);
  if (error) throw new Error(`Failed to load WhatsApp messages: ${error.message}`);
  return ((data ?? []) as unknown as MessageLogRow[]).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    eventName: r.events?.honoree_name ?? null,
    inviteeName: r.invitees?.name ?? null,
    recipientPhone: r.recipient_phone,
    messageType: r.message_type,
    templateName: r.template_name,
    category: r.category,
    status: r.status,
    attempts: r.attempts,
    errorCode: r.error_code,
    errorTitle: r.error_title,
    createdAt: r.created_at,
    sentAt: r.sent_at,
    deliveredAt: r.delivered_at,
    readAt: r.read_at,
    failedAt: r.failed_at,
  }));
}

export interface WhatsAppHealth {
  lastSuccessAt: string | null;
  lastError: { at: string; code: number | null; title: string | null } | null;
  lastWebhookAt: string | null;
}

/** Health signals only — no recipient data — so the owner can see them platform-wide. */
export async function getWhatsAppHealth(): Promise<WhatsAppHealth> {
  const client = supabaseAdmin();
  const [success, failure, webhook] = await Promise.all([
    client.from("whatsapp_messages").select("updated_at").in("status", ["accepted", "sent", "delivered", "read"]).order("updated_at", { ascending: false }).limit(1).maybeSingle<{ updated_at: string }>(),
    client.from("whatsapp_messages").select("updated_at, error_code, error_title").not("error_title", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle<{ updated_at: string; error_code: number | null; error_title: string | null }>(),
    client.from("whatsapp_webhook_events").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle<{ received_at: string }>(),
  ]);
  return {
    lastSuccessAt: success.data?.updated_at ?? null,
    lastError: failure.data ? { at: failure.data.updated_at, code: failure.data.error_code, title: failure.data.error_title } : null,
    lastWebhookAt: webhook.data?.received_at ?? null,
  };
}

export type WhatsAppConnection =
  | { ok: true; displayPhoneNumber: string | null; verifiedName: string | null; qualityRating: string | null }
  | { ok: false; error: string };

/** Live check against Graph: reads the sending number's display name/quality. Never echoes credentials. */
export async function checkWhatsAppConnection(): Promise<WhatsAppConnection> {
  const config = graphConfig();
  if (!config) return { ok: false, error: "Not configured." };
  const { httpStatus, json, networkError } = await graphRequest(config, `${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { method: "GET" });
  if (networkError) return { ok: false, error: networkError };
  if (httpStatus !== 200 || !json) {
    const err = json?.error as { code?: number; message?: string } | undefined;
    return { ok: false, error: `${err?.code ?? httpStatus}: ${(err?.message ?? "Request failed").slice(0, 200)}` };
  }
  return {
    ok: true,
    displayPhoneNumber: typeof json.display_phone_number === "string" ? json.display_phone_number : null,
    verifiedName: typeof json.verified_name === "string" ? json.verified_name : null,
    qualityRating: typeof json.quality_rating === "string" ? json.quality_rating : null,
  };
}
