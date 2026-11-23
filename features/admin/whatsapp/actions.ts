"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminForEvent, requireOwner } from "@/services/admin-auth";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-cloud/phone";
import { whatsappEnvStatus } from "@/lib/whatsapp-cloud/config";
import { isWhatsAppCategory, type WhatsAppTemplateMap } from "@/lib/whatsapp-cloud/types";
import {
  attestWhatsAppConsent,
  checkWhatsAppConnection,
  processWhatsAppOutbox,
  queueEventInvitations,
  revokeWhatsAppConsent,
  sendWhatsAppTestMessage,
  updateEventWhatsAppSettings,
  updateWhatsAppPlatformSettings,
  whatsappSendingAvailable,
  type WhatsAppConnection,
} from "@/services/whatsapp";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type WhatsAppActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

function fail(err: unknown): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

// ─── Owner: platform integration (/admin/whatsapp) ───────────────────────────

const platformSchema = z.object({
  enabled: z.boolean(),
  templates: z.record(
    z.string(),
    z.object({
      name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Template names are lowercase letters, numbers and underscores."),
      language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Language codes look like en or en_US."),
    }),
  ),
  testRecipients: z.array(z.string()).max(20),
});

export async function savePlatformWhatsAppSettingsAction(input: unknown): Promise<WhatsAppActionResult> {
  const parsed = platformSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  try {
    const admin = await requireOwner();
    const templates: WhatsAppTemplateMap = {};
    for (const [category, value] of Object.entries(parsed.data.templates)) {
      if (isWhatsAppCategory(category) && value.name) templates[category] = value;
    }
    const cc = whatsappEnvStatus().defaultCountryCode;
    const recipients: string[] = [];
    for (const raw of parsed.data.testRecipients) {
      const phone = normalizeWhatsAppPhone(raw, cc);
      if (!phone.ok) return { success: false, error: `Test recipient "${raw}": ${phone.error}` };
      if (!recipients.includes(phone.phone)) recipients.push(phone.phone);
    }
    await updateWhatsAppPlatformSettings(admin.id, { enabled: parsed.data.enabled, templates, testRecipients: recipients });
    revalidatePath("/admin/whatsapp");
    return { success: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function checkWhatsAppConnectionAction(): Promise<WhatsAppActionResult<WhatsAppConnection>> {
  try {
    await requireOwner();
    return { success: true, data: await checkWhatsAppConnection() };
  } catch (err) {
    return fail(err);
  }
}

const testSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  body: z.string().trim().max(1000).nullable(),
  confirmed: z.literal(true),
});

export async function sendWhatsAppTestAction(input: unknown): Promise<WhatsAppActionResult<{ status: string; reason?: string }>> {
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Confirm the test send and enter a recipient." };
  try {
    const admin = await requireOwner();
    const result = await sendWhatsAppTestMessage(admin.id, parsed.data.phone, parsed.data.body || null);
    if (!result.success) return result;
    revalidatePath("/admin/whatsapp");
    return { success: true, data: { status: result.data.status, reason: result.data.reason } };
  } catch (err) {
    return fail(err);
  }
}

// ─── Event hosts: one event's WhatsApp (/admin/event-whatsapp) ────────────────

const eventSettingsSchema = z.object({
  eventId: z.string().uuid(),
  enabled: z.boolean(),
  rsvpConfirmation: z.boolean(),
  reminder24h: z.boolean(),
  reminder2h: z.boolean(),
  thankYou: z.boolean(),
  memoryReminder: z.boolean(),
  feedbackRequest: z.boolean(),
});

export async function saveEventWhatsAppSettingsAction(input: unknown): Promise<WhatsAppActionResult> {
  const parsed = eventSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid settings." };
  try {
    const admin = await requireAdminForEvent(parsed.data.eventId);
    await updateEventWhatsAppSettings(admin.id, parsed.data);
    revalidatePath("/admin/event-whatsapp");
    return { success: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

const guestsSchema = z.object({
  eventId: z.string().uuid(),
  inviteeIds: z.array(z.string().uuid()).min(1).max(2000),
});

/** The host confirms these guests agreed to WhatsApp messages; `attested` must be ticked in the UI. */
export async function attestWhatsAppConsentAction(input: unknown): Promise<WhatsAppActionResult<{ recorded: number }>> {
  const parsed = guestsSchema.extend({ attested: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Select guests and confirm they agreed to receive WhatsApp messages." };
  try {
    const admin = await requireAdminForEvent(parsed.data.eventId);
    const recorded = await attestWhatsAppConsent(admin.id, parsed.data.eventId, parsed.data.inviteeIds);
    revalidatePath("/admin/event-whatsapp");
    return { success: true, data: { recorded } };
  } catch (err) {
    return fail(err);
  }
}

export async function revokeWhatsAppConsentAction(input: unknown): Promise<WhatsAppActionResult> {
  const parsed = guestsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Select guests first." };
  try {
    const admin = await requireAdminForEvent(parsed.data.eventId);
    await revokeWhatsAppConsent(admin.id, parsed.data.eventId, parsed.data.inviteeIds);
    revalidatePath("/admin/event-whatsapp");
    return { success: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

const invitationsSchema = z.object({
  eventId: z.string().uuid(),
  inviteeIds: z.array(z.string().uuid()).max(2000).nullable(),
  confirmed: z.literal(true),
});

/** Queues invitations for consented guests not yet invited. One run a minute per event. */
export async function sendWhatsAppInvitationsAction(
  input: unknown,
): Promise<WhatsAppActionResult<{ queued: number; duplicate: number; blocked: number; failed: number }>> {
  const parsed = invitationsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Confirm the send first." };
  try {
    const admin = await requireAdminForEvent(parsed.data.eventId);
    if (!(await whatsappSendingAvailable())) return { success: false, error: "WhatsApp sending isn't switched on for EveryMoment yet." };

    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin()
      .from("whatsapp_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("event_id", parsed.data.eventId)
      .eq("action", "invitations_queued")
      .gte("created_at", minuteAgo);
    if ((count ?? 0) > 0) return { success: false, error: "Invitations were just queued — give it a minute." };

    const counts = await queueEventInvitations(admin.id, parsed.data.eventId, parsed.data.inviteeIds);
    revalidatePath("/admin/event-whatsapp");
    return { success: true, data: counts };
  } catch (err) {
    return fail(err);
  }
}

/** Sends the next batch of this event's queued messages; the page calls it until `remaining` is 0. */
export async function processEventWhatsAppOutboxAction(eventId: string): Promise<WhatsAppActionResult<{ processed: number; remaining: number }>> {
  if (!z.string().uuid().safeParse(eventId).success) return { success: false, error: "Invalid event." };
  try {
    await requireAdminForEvent(eventId);
    const result = await processWhatsAppOutbox({ eventId, limit: 20, budgetMs: 7000 });
    return { success: true, data: result };
  } catch (err) {
    return fail(err);
  }
}
