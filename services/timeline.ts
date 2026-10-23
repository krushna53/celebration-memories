import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import type { TimelineMilestonePhoto, TimelineMilestoneRecord } from "@/types/content";

interface MilestoneRow {
  id: string;
  event_id: string;
  period: string;
  title: string;
  description: string;
  sort_order: number;
  image_path: string | null;
  created_at: string;
  taken_from?: string | null;
  taken_to?: string | null;
  lat?: number | null;
  lon?: number | null;
  place?: string | null;
  image_fingerprint?: string | null;
}

interface MilestonePhotoRow {
  id: string;
  milestone_id: string;
  event_id: string;
  storage_path: string;
  taken_at: string | null;
  fingerprint: string | null;
}

function mapPhoto(row: MilestonePhotoRow): TimelineMilestonePhoto {
  return {
    id: row.id,
    url: publicMediaUrl("gallery", row.storage_path),
    takenAt: row.taken_at ? row.taken_at.slice(0, 16) : null,
    fingerprint: row.fingerprint,
  };
}

function mapRow(row: MilestoneRow): TimelineMilestoneRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    period: row.period,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    imageUrl: row.image_path ? publicMediaUrl("gallery", row.image_path) : null,
    createdAt: row.created_at,
    takenFrom: row.taken_from ?? null,
    takenTo: row.taken_to ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    place: row.place ?? null,
    imageFingerprint: row.image_fingerprint ?? null,
  };
}

export async function listMilestones(eventId: string): Promise<TimelineMilestoneRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_milestones")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to list milestones: ${error.message}`);
  const milestones = (data as MilestoneRow[]).map(mapRow);
  if (milestones.length === 0) return milestones;

  // Extra photos are a bonus — if they can't be read, the timeline still renders exactly as before.
  const { data: photoRows, error: photoError } = await supabaseAdmin()
    .from("timeline_milestone_photos")
    .select("id, milestone_id, event_id, storage_path, taken_at, fingerprint")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("taken_at", { ascending: true, nullsFirst: false })
    .returns<MilestonePhotoRow[]>();
  if (photoError) {
    console.error("listMilestones: extra photos unavailable:", photoError.message);
    return milestones;
  }
  const byMilestone = new Map<string, TimelineMilestonePhoto[]>();
  for (const row of photoRows ?? []) byMilestone.set(row.milestone_id, [...(byMilestone.get(row.milestone_id) ?? []), mapPhoto(row)]);
  return milestones.map((m) => ({ ...m, photos: byMilestone.get(m.id) ?? [] }));
}

/** Used by the wizard's draft-scoped timeline actions to verify a milestone belongs to the caller's draft event before modifying it — see features/start/actions/timeline.ts. */
export async function getMilestoneById(id: string): Promise<TimelineMilestoneRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_milestones")
    .select("*")
    .eq("id", id)
    .maybeSingle<MilestoneRow>();

  if (error) throw new Error(`Failed to look up milestone: ${error.message}`);
  return data ? mapRow(data) : null;
}

export async function createMilestone(input: {
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder?: number;
  /** Only from the photo import — when/where its photos were taken. */
  meta?: MilestonePhotoMeta;
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_milestones")
    .insert({
      event_id: input.eventId,
      period: input.period,
      title: input.title,
      description: input.description,
      sort_order: input.sortOrder ?? 0,
      ...(input.meta ? metaColumns(input.meta) : {}),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Failed to add milestone: ${error?.message}`);
  return data.id;
}

export async function updateMilestone(
  id: string,
  input: {
    period?: string;
    title?: string;
    description?: string;
    sortOrder?: number;
    imagePath?: string | null;
    /** Only meaningful with imagePath — a replaced/removed cover drops the old cover's fingerprint. */
    imageFingerprint?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.period !== undefined) patch.period = input.period;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.imagePath !== undefined) {
    patch.image_path = input.imagePath;
    patch.image_fingerprint = cleanFingerprint(input.imageFingerprint);
  }

  const { error } = await supabaseAdmin().from("timeline_milestones").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update milestone: ${error.message}`);
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("timeline_milestones").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete milestone: ${error.message}`);
}

/** When/where a milestone's photos were taken. Every field is optional and validated here, since it comes from the browser. */
export interface MilestonePhotoMeta {
  /** "YYYY-MM-DD". */
  takenFrom?: string | null;
  takenTo?: string | null;
  lat?: number | null;
  lon?: number | null;
  place?: string | null;
  imageFingerprint?: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function cleanCoord(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max ? value : null;
}

function cleanFingerprint(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9:._-]{1,120}$/.test(value) ? value : null;
}

function metaColumns(meta: MilestonePhotoMeta) {
  const lat = cleanCoord(meta.lat, 90);
  const lon = cleanCoord(meta.lon, 180);
  const hasGps = lat !== null && lon !== null;
  return {
    taken_from: typeof meta.takenFrom === "string" && DAY.test(meta.takenFrom) ? meta.takenFrom : null,
    taken_to: typeof meta.takenTo === "string" && DAY.test(meta.takenTo) ? meta.takenTo : null,
    lat: hasGps ? lat : null,
    lon: hasGps ? lon : null,
    place: typeof meta.place === "string" && meta.place.trim() ? meta.place.trim().slice(0, 120) : null,
    image_fingerprint: cleanFingerprint(meta.imageFingerprint),
  };
}

/** Widens a milestone's stored date range / fills its place when photos are added to it later. Never narrows. */
export async function extendMilestoneMeta(milestone: TimelineMilestoneRecord, meta: MilestonePhotoMeta): Promise<void> {
  const next = metaColumns(meta);
  const patch: Record<string, unknown> = {};
  if (next.taken_from && (!milestone.takenFrom || next.taken_from < milestone.takenFrom)) patch.taken_from = next.taken_from;
  if (next.taken_to && (!milestone.takenTo || next.taken_to > milestone.takenTo)) patch.taken_to = next.taken_to;
  if (next.lat !== null && milestone.lat == null) {
    patch.lat = next.lat;
    patch.lon = next.lon;
  }
  if (next.place && !milestone.place) patch.place = next.place;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabaseAdmin().from("timeline_milestones").update(patch).eq("id", milestone.id);
  if (error) throw new Error(`Failed to update milestone dates: ${error.message}`);
}

export interface NewMilestonePhoto {
  path: string;
  originalName?: string | null;
  /** "YYYY-MM-DDTHH:mm". */
  takenAt?: string | null;
  lat?: number | null;
  lon?: number | null;
  fingerprint?: string | null;
}

/** Adds photos (already uploaded to `path`, checked by the caller) to a milestone after its existing ones. */
export async function addMilestonePhotos(milestone: TimelineMilestoneRecord, photos: NewMilestonePhoto[]): Promise<void> {
  if (photos.length === 0) return;
  const client = supabaseAdmin();
  const { data: last } = await client
    .from("timeline_milestone_photos")
    .select("sort_order")
    .eq("milestone_id", milestone.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const start = (last?.sort_order ?? -1) + 1;

  const rows = photos.map((p, i) => {
    const lat = cleanCoord(p.lat, 90);
    const lon = cleanCoord(p.lon, 180);
    return {
      milestone_id: milestone.id,
      event_id: milestone.eventId,
      storage_path: p.path,
      original_name: typeof p.originalName === "string" ? p.originalName.slice(0, 200) : null,
      taken_at: typeof p.takenAt === "string" && STAMP.test(p.takenAt) ? p.takenAt : null,
      lat: lat !== null && lon !== null ? lat : null,
      lon: lat !== null && lon !== null ? lon : null,
      fingerprint: cleanFingerprint(p.fingerprint),
      sort_order: start + i,
    };
  });
  const { error } = await client.from("timeline_milestone_photos").insert(rows);
  if (error) throw new Error(`Failed to add photos: ${error.message}`);
}

export async function getMilestonePhotoById(id: string): Promise<{ id: string; milestoneId: string; eventId: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_milestone_photos")
    .select("id, milestone_id, event_id")
    .eq("id", id)
    .maybeSingle<{ id: string; milestone_id: string; event_id: string }>();
  if (error) throw new Error(`Failed to look up photo: ${error.message}`);
  return data ? { id: data.id, milestoneId: data.milestone_id, eventId: data.event_id } : null;
}

/**
 * Only the row goes — the Storage object is left in place, like the
 * cover photo's "Remove" (timeline snapshots may still point at it).
 */
export async function deleteMilestonePhoto(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("timeline_milestone_photos").delete().eq("id", id);
  if (error) throw new Error(`Failed to remove photo: ${error.message}`);
}

/** Every photo fingerprint already on an event's timeline (covers + extra photos) → its milestone — for "already on your timeline" on re-import. */
export async function listTimelineFingerprints(eventId: string): Promise<Record<string, string>> {
  const client = supabaseAdmin();
  const [covers, extras] = await Promise.all([
    client.from("timeline_milestones").select("id, image_fingerprint").eq("event_id", eventId).not("image_fingerprint", "is", null),
    client.from("timeline_milestone_photos").select("milestone_id, fingerprint").eq("event_id", eventId).not("fingerprint", "is", null),
  ]);
  if (covers.error) throw new Error(`Failed to read timeline: ${covers.error.message}`);
  if (extras.error) throw new Error(`Failed to read timeline photos: ${extras.error.message}`);
  const map: Record<string, string> = {};
  for (const row of (covers.data ?? []) as { id: string; image_fingerprint: string }[]) map[row.image_fingerprint] = row.id;
  for (const row of (extras.data ?? []) as { milestone_id: string; fingerprint: string }[]) map[row.fingerprint] = row.milestone_id;
  return map;
}
