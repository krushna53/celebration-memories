"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForOrganizerArea } from "@/services/admin-auth";
import {
  bulkImportInvitees,
  createInvitee,
  deleteInvitee,
  getInviteeEventId,
  getRsvpExportRows,
  markInviteSent,
  setCheckedIn,
  updateInvitee,
  type InviteeInput,
} from "@/services/admin-invitees";
import { snapshotInvitees } from "@/services/event-snapshots";
import { toCsv } from "@/lib/csv";
import { inviteChannelLabel } from "@/lib/invite-channel";

export type AdminActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Every admin Server Action re-checks the `admins` allowlist itself.
 * Server Actions are independently callable HTTP endpoints — relying
 * only on the dashboard layout's redirect would leave these mutations
 * reachable by anyone who guesses the action's endpoint. Invitees is
 * one of the four areas the "organizer" role (#105) can manage, in
 * addition to owner and the matching client — see
 * requireAdminForOrganizerArea in services/admin-auth.ts. Check-In
 * (toggleCheckInAction below) is the one area of the four "client"
 * doesn't get — only owner and organizer.
 */

export async function createInviteeAction(
  eventId: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    const admin = await requireAdminForOrganizerArea(eventId, "invitees");
    if (!input.name?.trim()) {
      return { success: false, error: "Name is required." };
    }
    // Best-effort — never let a snapshot failure block the actual save.
    await snapshotInvitees(eventId, admin.id).catch((err) => console.error("snapshotInvitees failed:", err));
    await createInvitee(eventId, input);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateInviteeAction(
  id: string,
  eventId: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    const admin = await requireAdminForOrganizerArea(eventId, "invitees");
    await snapshotInvitees(eventId, admin.id).catch((err) => console.error("snapshotInvitees failed:", err));
    await updateInvitee(id, eventId, input);
    revalidatePath("/admin/invitees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteInviteeAction(id: string, eventId: string): Promise<AdminActionResult> {
  try {
    const admin = await requireAdminForOrganizerArea(eventId, "invitees");
    await snapshotInvitees(eventId, admin.id).catch((err) => console.error("snapshotInvitees failed:", err));
    await deleteInvitee(id, eventId);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Looks up which event a guest belongs to before checking access —
 * closes the gap where any logged-in admin could check in another
 * event's guest by id alone, same pattern as gallery/timeline's
 * requireAdminForPhoto/requireAdminForMilestone helpers.
 */
export async function toggleCheckInAction(
  id: string,
  checkedIn: boolean,
): Promise<AdminActionResult> {
  try {
    const eventId = await getInviteeEventId(id);
    if (!eventId) return { success: false, error: "Guest not found." };
    await requireAdminForOrganizerArea(eventId, "checkin");
    await setCheckedIn(id, checkedIn);
    revalidatePath("/admin/checkin");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Records that an admin tapped WhatsApp for this guest. Called right
 * after opening the wa.me link — best-effort tracking, not a delivery
 * receipt. Failures here shouldn't block the guest's WhatsApp tab, so
 * the manager UI opens WhatsApp first and calls this in the background.
 */
export async function markInviteSentAction(id: string, eventId: string): Promise<AdminActionResult> {
  try {
    await requireAdminForOrganizerArea(eventId, "invitees");
    await markInviteSent(id, eventId);
    revalidatePath("/admin/invitees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type ExportRsvpCsvResult =
  | { success: true; csv: string; filename: string }
  | { success: false; error: string };

/**
 * Returns the CSV as plain text rather than writing a file anywhere —
 * the browser turns it into a download client-side (see
 * invitee-manager.tsx's handleExport, which builds a Blob and clicks a
 * temporary <a download>). Available to owner, client, and organizer,
 * same as the rest of this file, scoped to the caller's own event.
 */
export async function exportRsvpCsvAction(eventId: string, eventSlug: string): Promise<ExportRsvpCsvResult> {
  try {
    await requireAdminForOrganizerArea(eventId, "invitees");
    const rows = await getRsvpExportRows(eventId);
    const csvRows = rows.map((row) => ({ ...row, inviteChannel: inviteChannelLabel(row.inviteChannel) }));
    const csv = toCsv(csvRows, [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "relationship", label: "Relationship" },
      { key: "rsvpStatus", label: "RSVP Status" },
      { key: "adults", label: "Adults" },
      { key: "children", label: "Children" },
      { key: "mealPreference", label: "Meal Preference" },
      { key: "comments", label: "Comments" },
      { key: "submittedAt", label: "Submitted At" },
      { key: "checkedIn", label: "Checked In" },
      { key: "visitCount", label: "Visits" },
      { key: "inviteSentAt", label: "Invite Sent At" },
      { key: "inviteChannel", label: "Invite Channel" },
    ]);
    return { success: true, csv, filename: `${eventSlug}-rsvps-${new Date().toISOString().slice(0, 10)}.csv` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Export failed." };
  }
}

export async function bulkImportInviteesAction(
  eventId: string,
  rows: InviteeInput[],
): Promise<
  { success: true; created: number; skipped: number } | { success: false; error: string }
> {
  try {
    const admin = await requireAdminForOrganizerArea(eventId, "invitees");
    // One snapshot for the whole import, not per row — a bad CSV import is exactly the "undo my mistake" case this feature exists for.
    await snapshotInvitees(eventId, admin.id, "Before CSV import").catch((err) => console.error("snapshotInvitees failed:", err));
    const result = await bulkImportInvitees(eventId, rows);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
