import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEventById, updateEvent, type EventUpdateInput } from "@/services/events";
import type { EventRecord } from "@/types/event";

/**
 * Per-event version history / backup & restore (task #70). One generic
 * table (event_snapshots) holds an opaque jsonb payload per area — the
 * shape of that payload is owned entirely by this file's per-area
 * serialize/restore pair, not by the schema, so adding a new area later
 * is additive (a new SnapshotArea value + a new serialize/restore pair),
 * never a migration.
 *
 * Covers: event_settings (honoree/venue/description/template/custom CSS
 * — see restoreEventSettingsSnapshot for the exact field whitelist),
 * gallery, timeline, and invitees. Both the owner and the event's own
 * client admin can view history and restore (features/admin/backups/).
 */
export type SnapshotArea = "event_settings" | "gallery" | "timeline" | "invitees";

const SNAPSHOTS_PER_AREA_CAP = 20;

export interface EventSnapshotRecord {
  id: string;
  eventId: string;
  area: SnapshotArea;
  snapshot: unknown;
  label: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface EventSnapshotRow {
  id: string;
  event_id: string;
  area: SnapshotArea;
  snapshot: unknown;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

function mapRow(row: EventSnapshotRow): EventSnapshotRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    area: row.area,
    snapshot: row.snapshot,
    label: row.label,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Saves a point-in-time snapshot, then prunes anything beyond the cap
 * for this (event, area) pair — best-effort, never throws, since a
 * snapshot failure should never block the real mutation it's guarding.
 * Every call site in features/admin/*\/actions.ts follows the same
 * "await createSnapshot(...).catch((err) => console.error(...))"
 * fire-and-forget shape.
 */
export async function createSnapshot(input: {
  eventId: string;
  area: SnapshotArea;
  snapshot: unknown;
  createdBy: string | null;
  label?: string | null;
}): Promise<void> {
  const client = supabaseAdmin();
  const { error } = await client.from("event_snapshots").insert({
    event_id: input.eventId,
    area: input.area,
    snapshot: input.snapshot,
    created_by: input.createdBy,
    label: input.label ?? null,
  });
  if (error) {
    console.error(`createSnapshot(${input.area}) failed:`, error.message);
    return;
  }

  const { data: overflow, error: overflowError } = await client
    .from("event_snapshots")
    .select("id")
    .eq("event_id", input.eventId)
    .eq("area", input.area)
    .order("created_at", { ascending: false })
    .range(SNAPSHOTS_PER_AREA_CAP, SNAPSHOTS_PER_AREA_CAP + 200);

  if (overflowError || !overflow || overflow.length === 0) return;

  await client
    .from("event_snapshots")
    .delete()
    .in(
      "id",
      overflow.map((r) => r.id as string),
    );
}

/** Newest first — the Backups page's per-area list. */
export async function listSnapshots(eventId: string, area: SnapshotArea, limit = SNAPSHOTS_PER_AREA_CAP): Promise<EventSnapshotRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_snapshots")
    .select("*")
    .eq("event_id", eventId)
    .eq("area", area)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<EventSnapshotRow[]>();

  if (error) throw new Error(`Failed to load snapshots: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function getSnapshotById(id: string): Promise<EventSnapshotRecord | null> {
  const { data, error } = await supabaseAdmin().from("event_snapshots").select("*").eq("id", id).maybeSingle<EventSnapshotRow>();
  if (error) throw new Error(`Failed to load snapshot: ${error.message}`);
  return data ? mapRow(data) : null;
}

// ---------------------------------------------------------------------
// Event Settings / Templates / Custom CSS — all one area, since they
// share the exact same `events` table row and the exact same
// updateEvent/updateEventAction entrypoint (confirmed: the Template
// picker calls updateEventAction directly with { templateSlug }).
// ---------------------------------------------------------------------

/**
 * Deliberately NOT the full EventRecord — excludes AI-generation quotas,
 * storage quota, payment/RSVP-pricing fields, Event Day settings, and
 * reminder toggles. Those are more "account configuration" than
 * "content a client edits and might want to undo," and restoring quota
 * numbers or payment pricing from an old snapshot is more likely to
 * surprise someone than help them. This whitelist is the "content" a
 * client actually edits from the Event Settings form day-to-day plus
 * Templates/Custom CSS.
 */
export interface EventSettingsSnapshotPayload {
  category: EventRecord["category"];
  occasion: string | null;
  honoreeName: string;
  eventTitle: string;
  hostedBy: string;
  venueName: string | null;
  venueAddress: string | null;
  mapsUrl: string | null;
  mapsEmbedUrl: string | null;
  parkingInfo: string | null;
  startAt: string;
  endAt: string;
  dressCode: string | null;
  timezone: string;
  visibility: "public" | "private";
  shortDescription: string | null;
  occasionDate: string | null;
  templateSlug: string;
  customCss: string | null;
  inviteMessageTemplate: string | null;
  publicRsvpEnabled: boolean;
  publicMemoriesEnabled: boolean;
  sectionConfig: EventRecord["sectionConfig"];
  additionalNotes: string | null;
  wishMessage: string | null;
}

export function serializeEventSettingsSnapshot(event: EventRecord): EventSettingsSnapshotPayload {
  return {
    category: event.category,
    occasion: event.occasion,
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    hostedBy: event.hostedBy,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    mapsUrl: event.mapsUrl,
    mapsEmbedUrl: event.mapsEmbedUrl,
    parkingInfo: event.parkingInfo,
    startAt: event.startAt,
    endAt: event.endAt,
    dressCode: event.dressCode,
    timezone: event.timezone,
    visibility: event.visibility,
    shortDescription: event.shortDescription,
    occasionDate: event.occasionDate,
    templateSlug: event.templateSlug,
    customCss: event.customCss,
    inviteMessageTemplate: event.inviteMessageTemplate,
    publicRsvpEnabled: event.publicRsvpEnabled,
    publicMemoriesEnabled: event.publicMemoriesEnabled,
    sectionConfig: event.sectionConfig,
    additionalNotes: event.additionalNotes,
    wishMessage: event.wishMessage,
  };
}

/** Best-effort snapshot-before-mutate — called from updateEventAction/updateSectionConfigAction right after auth, before the real write. */
export async function snapshotEventSettings(eventId: string, createdBy: string | null, label?: string | null): Promise<void> {
  const event = await getEventById(eventId);
  if (!event) return;
  await createSnapshot({ eventId, area: "event_settings", snapshot: serializeEventSettingsSnapshot(event), createdBy, label: label ?? null });
}

/**
 * Restores Event Settings/Templates/Custom CSS to a prior snapshot.
 * Snapshots the CURRENT state first (labeled "Before restore") so
 * restoring is itself undoable — the whole point of this feature is
 * "I can always get back to where I was."
 */
export async function restoreEventSettingsSnapshot(snapshotId: string, restoredBy: string | null): Promise<{ eventId: string }> {
  const snap = await getSnapshotById(snapshotId);
  if (!snap) throw new Error("Snapshot not found.");
  if (snap.area !== "event_settings") throw new Error("That snapshot isn't an Event Settings snapshot.");

  await snapshotEventSettings(snap.eventId, restoredBy, "Before restore");

  const payload = snap.snapshot as EventSettingsSnapshotPayload;
  const patch: EventUpdateInput = { ...payload };
  await updateEvent(snap.eventId, patch);
  return { eventId: snap.eventId };
}

// ---------------------------------------------------------------------
// Gallery — a true point-in-time "hard revert": rows present in the
// snapshot are re-inserted/updated back to their snapshotted values,
// and rows that exist now but weren't in the snapshot (added since) are
// deleted, including their Storage object — this is the one area where
// deleting later additions is the whole point of "restore" (undo a
// messy batch of uploads/edits), unlike Invitees below where deleting a
// guest added since the snapshot would be actively dangerous.
// ---------------------------------------------------------------------

interface GalleryPhotoSnapshotRow {
  id: string;
  category: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
}

export async function snapshotGallery(eventId: string, createdBy: string | null, label?: string | null): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("gallery_photos")
    .select("id, category, storage_path, caption, sort_order")
    .eq("event_id", eventId)
    .returns<GalleryPhotoSnapshotRow[]>();
  if (error) {
    console.error("snapshotGallery failed to read current gallery:", error.message);
    return;
  }
  await createSnapshot({ eventId, area: "gallery", snapshot: data ?? [], createdBy, label: label ?? null });
}

export async function restoreGallerySnapshot(snapshotId: string, restoredBy: string | null): Promise<{ eventId: string }> {
  const snap = await getSnapshotById(snapshotId);
  if (!snap) throw new Error("Snapshot not found.");
  if (snap.area !== "gallery") throw new Error("That snapshot isn't a Gallery snapshot.");

  await snapshotGallery(snap.eventId, restoredBy, "Before restore");

  const client = supabaseAdmin();
  const target = (snap.snapshot as GalleryPhotoSnapshotRow[]) ?? [];
  const targetIds = new Set(target.map((row) => row.id));

  const { data: current, error: currentError } = await client
    .from("gallery_photos")
    .select("id, storage_path")
    .eq("event_id", snap.eventId)
    .returns<{ id: string; storage_path: string }[]>();
  if (currentError) throw new Error(`Failed to read current gallery: ${currentError.message}`);

  const toDelete = (current ?? []).filter((row) => !targetIds.has(row.id));
  if (toDelete.length > 0) {
    const paths = toDelete.map((row) => row.storage_path).filter(Boolean);
    if (paths.length > 0) await client.storage.from("gallery").remove(paths);
    await client
      .from("gallery_photos")
      .delete()
      .in(
        "id",
        toDelete.map((row) => row.id),
      );
  }

  for (const row of target) {
    const { error: upsertError } = await client.from("gallery_photos").upsert({
      id: row.id,
      event_id: snap.eventId,
      category: row.category,
      storage_path: row.storage_path,
      caption: row.caption,
      sort_order: row.sort_order,
    });
    if (upsertError) throw new Error(`Failed to restore gallery photo: ${upsertError.message}`);
  }

  return { eventId: snap.eventId };
}

// ---------------------------------------------------------------------
// Timeline — same hard-revert shape as Gallery.
// ---------------------------------------------------------------------

interface TimelineMilestoneSnapshotRow {
  id: string;
  period: string;
  title: string;
  description: string;
  sort_order: number;
  image_path: string | null;
}

export async function snapshotTimeline(eventId: string, createdBy: string | null, label?: string | null): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_milestones")
    .select("id, period, title, description, sort_order, image_path")
    .eq("event_id", eventId)
    .returns<TimelineMilestoneSnapshotRow[]>();
  if (error) {
    console.error("snapshotTimeline failed to read current timeline:", error.message);
    return;
  }
  await createSnapshot({ eventId, area: "timeline", snapshot: data ?? [], createdBy, label: label ?? null });
}

export async function restoreTimelineSnapshot(snapshotId: string, restoredBy: string | null): Promise<{ eventId: string }> {
  const snap = await getSnapshotById(snapshotId);
  if (!snap) throw new Error("Snapshot not found.");
  if (snap.area !== "timeline") throw new Error("That snapshot isn't a Timeline snapshot.");

  await snapshotTimeline(snap.eventId, restoredBy, "Before restore");

  const client = supabaseAdmin();
  const target = (snap.snapshot as TimelineMilestoneSnapshotRow[]) ?? [];
  const targetIds = new Set(target.map((row) => row.id));

  const { data: current, error: currentError } = await client
    .from("timeline_milestones")
    .select("id, image_path")
    .eq("event_id", snap.eventId)
    .returns<{ id: string; image_path: string | null }[]>();
  if (currentError) throw new Error(`Failed to read current timeline: ${currentError.message}`);

  const toDelete = (current ?? []).filter((row) => !targetIds.has(row.id));
  if (toDelete.length > 0) {
    const paths = toDelete.map((row) => row.image_path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) await client.storage.from("gallery").remove(paths);
    await client
      .from("timeline_milestones")
      .delete()
      .in(
        "id",
        toDelete.map((row) => row.id),
      );
  }

  for (const row of target) {
    const { error: upsertError } = await client.from("timeline_milestones").upsert({
      id: row.id,
      event_id: snap.eventId,
      period: row.period,
      title: row.title,
      description: row.description,
      sort_order: row.sort_order,
      image_path: row.image_path,
    });
    if (upsertError) throw new Error(`Failed to restore milestone: ${upsertError.message}`);
  }

  return { eventId: snap.eventId };
}

// ---------------------------------------------------------------------
// Invitees — deliberately NOT a hard revert, unlike Gallery/Timeline.
// Guest data is higher-stakes: an invitee added after the snapshot may
// already have been sent a real invite link, so restore NEVER deletes
// rows that weren't in the snapshot. For rows that still exist, restore
// only touches the content fields a client actually edits (name/phone/
// email/relationship/inviteChannel) — never token, rsvp_status,
// checked_in, opened_at/last_opened_at/visit_count, or invite_sent_at,
// since those reflect real guest activity that happened since the
// snapshot and reverting them would be actively wrong. A row that WAS
// deleted since the snapshot is fully re-inserted (every field,
// including its original token) so the guest's already-shared invite
// link keeps working exactly as before.
// ---------------------------------------------------------------------

interface InviteeSnapshotRow {
  id: string;
  token: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  visit_count: number;
  rsvp_status: string;
  checked_in: boolean;
  invite_sent_at: string | null;
  invite_channel: string | null;
}

export async function snapshotInvitees(eventId: string, createdBy: string | null, label?: string | null): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("invitees")
    .select(
      "id, token, name, phone, email, relationship, opened_at, last_opened_at, visit_count, rsvp_status, checked_in, invite_sent_at, invite_channel",
    )
    .eq("event_id", eventId)
    .returns<InviteeSnapshotRow[]>();
  if (error) {
    console.error("snapshotInvitees failed to read current invitees:", error.message);
    return;
  }
  await createSnapshot({ eventId, area: "invitees", snapshot: data ?? [], createdBy, label: label ?? null });
}

export interface RestoreInviteesResult {
  eventId: string;
  updated: number;
  recreated: number;
  untouchedAdditions: number;
}

export async function restoreInviteesSnapshot(snapshotId: string, restoredBy: string | null): Promise<RestoreInviteesResult> {
  const snap = await getSnapshotById(snapshotId);
  if (!snap) throw new Error("Snapshot not found.");
  if (snap.area !== "invitees") throw new Error("That snapshot isn't an Invitees snapshot.");

  await snapshotInvitees(snap.eventId, restoredBy, "Before restore");

  const client = supabaseAdmin();
  const target = (snap.snapshot as InviteeSnapshotRow[]) ?? [];

  const { data: current, error: currentError } = await client
    .from("invitees")
    .select("id")
    .eq("event_id", snap.eventId)
    .returns<{ id: string }[]>();
  if (currentError) throw new Error(`Failed to read current invitees: ${currentError.message}`);
  const currentIds = new Set((current ?? []).map((row) => row.id));
  const targetIds = new Set(target.map((row) => row.id));

  let updated = 0;
  let recreated = 0;

  for (const row of target) {
    if (currentIds.has(row.id)) {
      const { error: updateError } = await client
        .from("invitees")
        .update({
          name: row.name,
          phone: row.phone,
          email: row.email,
          relationship: row.relationship,
          invite_channel: row.invite_channel,
        })
        .eq("id", row.id)
        .eq("event_id", snap.eventId);
      if (updateError) throw new Error(`Failed to restore invitee: ${updateError.message}`);
      updated++;
    } else {
      const { error: insertError } = await client.from("invitees").insert({
        id: row.id,
        event_id: snap.eventId,
        token: row.token,
        name: row.name,
        phone: row.phone,
        email: row.email,
        relationship: row.relationship,
        opened_at: row.opened_at,
        last_opened_at: row.last_opened_at,
        visit_count: row.visit_count,
        rsvp_status: row.rsvp_status,
        checked_in: row.checked_in,
        invite_sent_at: row.invite_sent_at,
        invite_channel: row.invite_channel,
      });
      if (insertError) throw new Error(`Failed to recreate invitee: ${insertError.message}`);
      recreated++;
    }
  }

  const untouchedAdditions = Array.from(currentIds).filter((id) => !targetIds.has(id)).length;

  return { eventId: snap.eventId, updated, recreated, untouchedAdditions };
}

/** Who created each snapshot, batched for the Backups page — id -> display name/email. */
export async function getSnapshotCreatorNames(adminIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(adminIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabaseAdmin().from("admins").select("id, name, email").in("id", uniqueIds).returns<
    { id: string; name: string | null; email: string }[]
  >();

  if (error) {
    console.error("getSnapshotCreatorNames failed:", error.message);
    return {};
  }

  return Object.fromEntries((data ?? []).map((a) => [a.id, a.name || a.email]));
}
