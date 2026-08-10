import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendRsvpSubmittedNotification } from "@/lib/email";
import { getOrganizersForSession } from "@/services/session-organizers";
import type { RsvpFormValues } from "@/types/rsvp";

export type AdminNotificationType =
  | "rsvp_submitted"
  | "feature_nudge"
  | "storage_usage"
  | "new_event_prompt"
  | "event_payment_settings_submitted"
  | "event_payment_settings_reviewed"
  | "rsvp_payment_submitted"
  | "rsvp_payment_received";

export interface AdminNotification {
  id: string;
  adminId: string;
  eventId: string | null;
  type: AdminNotificationType;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  admin_id: string;
  event_id: string | null;
  type: AdminNotificationType;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

function mapRow(row: NotificationRow): AdminNotification {
  return {
    id: row.id,
    adminId: row.admin_id,
    eventId: row.event_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    metadata: row.metadata,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Most recent notifications for one admin, newest first — the bell panel's list. */
export async function listNotificationsForAdmin(adminId: string, limit = 20): Promise<AdminNotification[]> {
  const { data, error } = await supabaseAdmin()
    .from("admin_notifications")
    .select("*")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listNotificationsForAdmin failed:", error.message);
    return [];
  }
  return (data as NotificationRow[]).map(mapRow);
}

/** Unread count for the bell icon's badge. */
export async function getUnreadNotificationCount(adminId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .is("read_at", null);

  if (error) {
    console.error("getUnreadNotificationCount failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Marks one notification read — ownership-checked (adminId must match) so an admin can never mark another admin's notification, same defense-in-depth as every other guest/admin-scoped mutation in this app. */
export async function markNotificationRead(id: string, adminId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("admin_id", adminId)
    .is("read_at", null);

  if (error) throw new Error(`Failed to mark notification read: ${error.message}`);
}

export async function markAllNotificationsRead(adminId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("admin_id", adminId)
    .is("read_at", null);

  if (error) throw new Error(`Failed to mark notifications read: ${error.message}`);
}

/** Inserts one notification. Every producer (RSVP alert, feature nudge, storage warning, new-event prompt) funnels through this. */
export async function createAdminNotification(input: {
  adminId: string;
  eventId?: string | null;
  type: AdminNotificationType;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("admin_notifications").insert({
    admin_id: input.adminId,
    event_id: input.eventId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    console.error("createAdminNotification failed:", error.message);
  }
}

/**
 * De-dupe check for the recurring producers (feature nudges, storage
 * warnings, new-event prompts) — "has this admin already gotten a
 * notification of this type (optionally matching a metadata key/value,
 * e.g. a specific feature_key) since `sinceIso`?" Reuses
 * admin_notifications itself as the record of what's already been
 * sent, rather than a separate tracking table.
 */
export async function hasRecentNotification(params: {
  adminId: string;
  type: AdminNotificationType;
  sinceIso: string;
  metadataKey?: string;
  metadataValue?: string;
}): Promise<boolean> {
  let query = supabaseAdmin()
    .from("admin_notifications")
    .select("id")
    .eq("admin_id", params.adminId)
    .eq("type", params.type)
    .gte("created_at", params.sinceIso)
    .limit(1);

  if (params.metadataKey && params.metadataValue) {
    query = query.eq(`metadata->>${params.metadataKey}`, params.metadataValue);
  }

  const { data, error } = await query;
  if (error) {
    console.error("hasRecentNotification failed:", error.message);
    return true; // fail closed — better to skip a send than double-send on a query error
  }
  return (data?.length ?? 0) > 0;
}

/** Owners only, never the event's own client admin — used when a client submits something that needs owner review (e.g. event payment settings), so the submitter doesn't get notified about their own action. */
async function getOwnersToNotify(): Promise<{ id: string; email: string; name: string | null }[]> {
  const { data, error } = await supabaseAdmin().from("admins").select("id, email, name").eq("role", "owner");
  if (error) {
    console.error("getOwnersToNotify failed:", error.message);
    return [];
  }
  return (data ?? []) as { id: string; email: string; name: string | null }[];
}

/** A client submitted (or resubmitted) their event's own payment settings for review — see features/admin/event-payment-settings/actions.ts. */
export async function notifyOwnersOfEventPaymentSettingsSubmission(params: {
  eventId: string;
  eventTitle: string;
  honoreeName: string;
}): Promise<void> {
  const owners = await getOwnersToNotify();
  if (owners.length === 0) return;

  const title = "New payment settings need review";
  const body = `${params.honoreeName}'s ${params.eventTitle} submitted payment settings — review before guests can pay through them.`;

  await Promise.all(
    owners.map((owner) =>
      createAdminNotification({
        adminId: owner.id,
        eventId: params.eventId,
        type: "event_payment_settings_submitted",
        title,
        body,
        link: "/admin/payment-settings-review",
      }),
    ),
  );
}

/** The owner approved or rejected a client's submitted payment settings — see features/admin/payment-settings-review/actions.ts. */
export async function notifyClientOfEventPaymentSettingsReview(params: {
  adminId: string;
  eventId: string;
  approved: boolean;
  note: string | null;
}): Promise<void> {
  const title = params.approved ? "Payment settings approved" : "Payment settings need changes";
  const body = params.approved
    ? "Your payment settings were approved — guests can now pay through your configuration."
    : `Your payment settings were sent back for changes${params.note ? `: ${params.note}` : "."}`;

  await createAdminNotification({
    adminId: params.adminId,
    eventId: params.eventId,
    type: "event_payment_settings_reviewed",
    title,
    body,
    link: "/admin/payment-settings-request",
  });
}

/**
 * A guest's RSVP payment either needs manual review (a bank/UPI
 * reference note was just submitted) or just succeeded (gateway-
 * verified, or an admin approved a manual one) — notifies every admin
 * tied to the event (client host + owner). Session-organizer
 * notification is deferred to #63 (no organizer concept exists yet).
 */
export async function notifyAdminsOfRsvpPayment(params: {
  eventId: string;
  guestName: string;
  amount: number;
  currency: string;
  needsReview: boolean;
  /** Set only for a per-session payment (#63) — additionally notifies that session's organizer(s), not just the event's own admins. */
  scheduleItemId?: string | null;
  sessionTitle?: string | null;
}): Promise<void> {
  const admins = await getAdminsToNotifyForEvent(params.eventId);

  const type: AdminNotificationType = params.needsReview ? "rsvp_payment_submitted" : "rsvp_payment_received";
  const title = params.needsReview ? "Payment needs review" : "Payment received";
  const sessionSuffix = params.sessionTitle ? ` (${params.sessionTitle})` : "";
  const body = params.needsReview
    ? `${params.guestName} submitted a payment reference for ${params.currency} ${params.amount}${sessionSuffix} — review it under RSVP Payments.`
    : `${params.guestName} paid ${params.currency} ${params.amount}${sessionSuffix} to confirm their registration.`;

  const notifyIds = new Set<string>();
  const recipients: { id: string; email: string; name: string | null }[] = [...admins];

  if (params.scheduleItemId) {
    const organizers = await getOrganizersForSession(params.scheduleItemId);
    for (const organizer of organizers) {
      if (!recipients.some((r) => r.id === organizer.id)) recipients.push(organizer);
    }
  }

  await Promise.all(
    recipients
      .filter((admin) => {
        if (notifyIds.has(admin.id)) return false;
        notifyIds.add(admin.id);
        return true;
      })
      .map((admin) =>
        createAdminNotification({
          adminId: admin.id,
          eventId: params.eventId,
          type,
          title,
          body,
          link: "/admin/rsvp-payments",
        }),
      ),
  );
}

/** All admins who should hear about activity on one event: the client admin scoped to it (if any) plus every owner. Used by the RSVP-submitted producer and could be reused by any other per-event producer. */
export async function getAdminsToNotifyForEvent(eventId: string): Promise<{ id: string; email: string; name: string | null }[]> {
  const [{ data: clientAdmin }, { data: owners }] = await Promise.all([
    supabaseAdmin().from("admins").select("id, email, name").eq("event_id", eventId).maybeSingle<{
      id: string;
      email: string;
      name: string | null;
    }>(),
    supabaseAdmin().from("admins").select("id, email, name").eq("role", "owner"),
  ]);

  const result: { id: string; email: string; name: string | null }[] = [];
  if (clientAdmin) result.push(clientAdmin);
  for (const owner of (owners ?? []) as { id: string; email: string; name: string | null }[]) {
    if (!result.some((a) => a.id === owner.id)) result.push(owner);
  }
  return result;
}

/**
 * Shared by both RSVP entry points (features/rsvp/actions.ts's
 * submitRsvpAction and public-rsvp-actions.ts's submitPublicRsvpAction)
 * — creates an in-app notification plus an email for every admin tied
 * to the event (client host + owner). Always best-effort from the
 * caller's side: never let a failure here fail the RSVP itself, which
 * is already saved by the time this runs.
 */
export async function notifyAdminsOfRsvpSubmission(params: {
  eventId: string;
  honoreeName: string;
  eventTitle: string;
  values: Pick<RsvpFormValues, "name" | "coming">;
  host: string | null;
}): Promise<void> {
  const { eventId, honoreeName, eventTitle, values, host } = params;
  const admins = await getAdminsToNotifyForEvent(eventId);
  if (admins.length === 0) return;

  const comingLabel = values.coming === "coming" ? "is coming" : values.coming === "maybe" ? "might come" : "can't make it";
  const title = `${values.name} RSVP'd`;
  const body = `${values.name} ${comingLabel} to ${honoreeName}'s ${eventTitle}.`;
  const adminDashboardUrl = host ? `https://${host}/admin/invitees` : "/admin/invitees";

  await Promise.all(
    admins.map(async (admin) => {
      await createAdminNotification({
        adminId: admin.id,
        eventId,
        type: "rsvp_submitted",
        title,
        body,
        link: "/admin/invitees",
      });
      await sendRsvpSubmittedNotification({
        adminEmail: admin.email,
        guestName: values.name,
        honoreeName,
        eventTitle,
        coming: values.coming,
        adminDashboardUrl,
      }).catch((err) => console.error(`sendRsvpSubmittedNotification failed for ${admin.email}:`, err));
    }),
  );
}
