import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedMediaPath } from "@/lib/media-url";
import { SITE_URL } from "@/lib/constants";
import { formatEventDate } from "@/lib/timezone";
import { getTemplateBySlug } from "@/lib/templates";
import { REEL_MUSIC, resolveReelMusic, type ReelMusicKey } from "@/lib/reel-music";
import { buildGuestReelEdit, type FaceBox, type ReelPhoto } from "@/lib/guest-reel-edit";
import { externalMediaUrl } from "@/services/external-media";
import { assertEventStorageAvailable, StorageQuotaError } from "@/services/storage-quota";
import { UploadValidationError } from "@/services/uploads";
import type { EventRecord } from "@/types/event";

/**
 * Personalised Guest Reels — see supabase/migrations/20261006140000_guest_reels.sql
 * for the data model and consent rules, lib/guest-reel-edit.ts for the
 * video itself, and features/admin/reels/ for the host's workflow:
 *
 *   1. Consent photos: guests add a selfie (RSVP form / after-event
 *      invite page), the host can add one for a guest who agreed, and the
 *      guest-of-honour photo is set with its own confirmation.
 *   2. After the event, the host uploads photos from the day (event_photos);
 *      approved guest Memory Wall photos are included automatically.
 *   3. The host's browser scans every photo for faces and stores who
 *      appears where (reel_photo_scans / reel_photo_faces).
 *   4. One reel per opted-in guest is queued here and rendered by the
 *      guest-reel-render Edge Function (Shotstack), then shown on the
 *      guest's invite page and a public /reels/[shareToken] share page.
 *
 * All photos live in the private `photos` bucket; result videos in the
 * private `videos` bucket.
 */

const PHOTO_BUCKET = "photos";
const VIDEO_BUCKET = "videos";
const FACE_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
const EVENT_PHOTO_MAX_BYTES = 50 * 1024 * 1024;
const MAX_EVENT_PHOTOS_PER_GUEST = 30;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ReelStatus = "queued" | "rendering" | "done" | "error";

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .slice(-60);
}

function assertImage(contentType: string, fileSize: number, maxBytes: number) {
  const type = (contentType.split(";")[0] ?? contentType).trim();
  if (!IMAGE_TYPES.includes(type)) throw new UploadValidationError("Please choose a JPEG, PNG or WEBP photo.");
  if (fileSize > maxBytes) {
    throw new UploadValidationError(`That photo is too large — the limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
}

async function ensureSpace(eventId: string, fileSize: number, audience: "guest" | "host") {
  try {
    await assertEventStorageAvailable(eventId, fileSize, audience);
  } catch (err) {
    if (err instanceof StorageQuotaError) throw new UploadValidationError(err.message);
    throw err;
  }
}

async function signUpload(path: string) {
  const { data, error } = await supabaseAdmin().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  return { bucket: PHOTO_BUCKET, path, token: data.token, signedUrl: data.signedUrl, viewUrl: signedMediaPath("photos", path) };
}

async function removeStorage(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length === 0) return;
  const { error } = await supabaseAdmin().storage.from(PHOTO_BUCKET).remove(list);
  if (error) console.error("guest-reels removeStorage failed:", error.message);
}

/* ------------------------------------------------------------------ */
/* Settings + consent photos                                            */
/* ------------------------------------------------------------------ */

export interface ReelSettings {
  enabled: boolean;
  honoreePhotoUrl: string | null;
  honoreeConsentAt: string | null;
  music: ReelMusicKey;
  renderLimit: number;
  rendersUsed: number;
}

export async function getReelSettings(eventId: string): Promise<ReelSettings> {
  const client = supabaseAdmin();
  const [{ data, error }, rendersUsed] = await Promise.all([
    client
      .from("events")
      .select("guest_reels_enabled, reel_honoree_photo_path, reel_honoree_consent_at, reel_music, guest_reel_render_limit")
      .eq("id", eventId)
      .maybeSingle<{
        guest_reels_enabled: boolean;
        reel_honoree_photo_path: string | null;
        reel_honoree_consent_at: string | null;
        reel_music: string;
        guest_reel_render_limit: number;
      }>(),
    countReelRenders(eventId),
  ]);
  if (error) throw new Error(`Failed to load reel settings: ${error.message}`);
  return {
    enabled: data?.guest_reels_enabled ?? false,
    honoreePhotoUrl: data?.reel_honoree_photo_path ? signedMediaPath("photos", data.reel_honoree_photo_path) : null,
    honoreeConsentAt: data?.reel_honoree_consent_at ?? null,
    music: resolveReelMusic(data?.reel_music),
    renderLimit: data?.guest_reel_render_limit ?? 60,
    rendersUsed,
  };
}

/** Cheap check used by guest-facing pages to decide whether to show the reel opt-in at all. */
export async function areGuestReelsEnabled(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("events")
    .select("guest_reels_enabled")
    .eq("id", eventId)
    .maybeSingle<{ guest_reels_enabled: boolean }>();
  return data?.guest_reels_enabled ?? false;
}

export async function updateReelSettings(eventId: string, input: { enabled?: boolean; music?: string }) {
  const patch: Record<string, unknown> = {};
  if (input.enabled !== undefined) patch.guest_reels_enabled = input.enabled;
  if (input.music !== undefined) patch.reel_music = resolveReelMusic(input.music);
  const { error } = await supabaseAdmin().from("events").update(patch).eq("id", eventId);
  if (error) throw new Error(`Failed to save reel settings: ${error.message}`);
}

/** Face photos are stored under the event so storage accounting and cleanup stay per-event. */
export async function createSignedReelFaceUpload(params: {
  eventId: string;
  owner: "honoree" | string;
  fileName: string;
  contentType: string;
  fileSize: number;
  audience: "guest" | "host";
}) {
  assertImage(params.contentType, params.fileSize, FACE_PHOTO_MAX_BYTES);
  await ensureSpace(params.eventId, params.fileSize, params.audience);
  return signUpload(`${params.eventId}/reel-faces/${params.owner}-${randomUUID()}-${sanitizeFileName(params.fileName)}`);
}

function isOwnFacePath(eventId: string, owner: string, path: string) {
  return path.startsWith(`${eventId}/reel-faces/${owner}-`) && !path.includes("..");
}

/** Sets (with consent recorded now) or clears the guest-of-honour reference photo. Clearing also forgets every honoree match. */
export async function setHonoreeReelPhoto(eventId: string, path: string | null) {
  if (path && !isOwnFacePath(eventId, "honoree", path)) throw new Error("That file doesn't belong to this event.");
  const client = supabaseAdmin();
  const { data: current } = await client
    .from("events")
    .select("reel_honoree_photo_path")
    .eq("id", eventId)
    .maybeSingle<{ reel_honoree_photo_path: string | null }>();

  const { error } = await client
    .from("events")
    .update({ reel_honoree_photo_path: path, reel_honoree_consent_at: path ? new Date().toISOString() : null })
    .eq("id", eventId);
  if (error) throw new Error(`Failed to save the photo: ${error.message}`);

  if (current?.reel_honoree_photo_path && current.reel_honoree_photo_path !== path) {
    await removeStorage([current.reel_honoree_photo_path]);
  }
  // A new reference face means old matches may be wrong — rescan needed.
  await client.from("reel_photo_faces").delete().eq("event_id", eventId).eq("is_honoree", true);
}

/** Sets (with consent recorded now) or clears a guest's reference photo. Clearing withdraws consent and forgets their matches. */
export async function setInviteeReelPhoto(params: {
  eventId: string;
  inviteeId: string;
  path: string | null;
  source: "guest" | "host";
}) {
  const { eventId, inviteeId, path, source } = params;
  if (path && !isOwnFacePath(eventId, inviteeId, path)) throw new Error("That file doesn't belong to this guest.");
  const client = supabaseAdmin();
  const { data: current } = await client
    .from("invitees")
    .select("reel_photo_path, event_id")
    .eq("id", inviteeId)
    .maybeSingle<{ reel_photo_path: string | null; event_id: string }>();
  if (!current || current.event_id !== eventId) throw new Error("Guest not found.");

  const { error } = await client
    .from("invitees")
    .update({
      reel_photo_path: path,
      reel_consent_at: path ? new Date().toISOString() : null,
      reel_consent_source: path ? source : null,
    })
    .eq("id", inviteeId);
  if (error) throw new Error(`Failed to save the photo: ${error.message}`);

  if (current.reel_photo_path && current.reel_photo_path !== path) await removeStorage([current.reel_photo_path]);
  await client.from("reel_photo_faces").delete().eq("invitee_id", inviteeId);
}

/* ------------------------------------------------------------------ */
/* Event-day photos (the reel pool)                                     */
/* ------------------------------------------------------------------ */

export async function createSignedEventPhotoUpload(params: {
  eventId: string;
  inviteeId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  assertImage(params.contentType, params.fileSize, EVENT_PHOTO_MAX_BYTES);
  await ensureSpace(params.eventId, params.fileSize, params.inviteeId ? "guest" : "host");
  if (params.inviteeId) {
    const { count } = await supabaseAdmin()
      .from("event_photos")
      .select("id", { count: "exact", head: true })
      .eq("invitee_id", params.inviteeId);
    if ((count ?? 0) >= MAX_EVENT_PHOTOS_PER_GUEST) {
      throw new UploadValidationError(`You can add up to ${MAX_EVENT_PHOTOS_PER_GUEST} photos.`);
    }
  }
  const owner = params.inviteeId ?? "host";
  return signUpload(`${params.eventId}/event-photos/${owner}-${randomUUID()}-${sanitizeFileName(params.fileName)}`);
}

export async function confirmEventPhoto(params: { eventId: string; inviteeId: string | null; path: string }) {
  const owner = params.inviteeId ?? "host";
  if (!params.path.startsWith(`${params.eventId}/event-photos/${owner}-`) || params.path.includes("..")) {
    throw new Error("That file doesn't belong to this event.");
  }
  const { data, error } = await supabaseAdmin()
    .from("event_photos")
    .insert({
      event_id: params.eventId,
      invitee_id: params.inviteeId,
      storage_path: params.path,
      uploaded_by: params.inviteeId ? "guest" : "host",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Failed to save the photo: ${error?.message}`);
  return { id: data.id, url: signedMediaPath("photos", params.path) };
}

/** Host deletes any event photo; a guest only their own (pass inviteeId). */
export async function deleteEventPhoto(params: { eventId: string; photoId: string; inviteeId?: string }) {
  const client = supabaseAdmin();
  let query = client.from("event_photos").select("id, storage_path").eq("id", params.photoId).eq("event_id", params.eventId);
  if (params.inviteeId) query = query.eq("invitee_id", params.inviteeId);
  const { data } = await query.maybeSingle<{ id: string; storage_path: string }>();
  if (!data) throw new Error("Photo not found.");
  await client.from("reel_photo_scans").delete().eq("source", "event").eq("source_id", data.id);
  const { error } = await client.from("event_photos").delete().eq("id", data.id);
  if (error) throw new Error(`Failed to delete: ${error.message}`);
  await removeStorage([data.storage_path]);
}

export interface PoolPhoto {
  source: "event" | "memory";
  sourceId: string;
  url: string;
  uploadedBy: "host" | "guest";
  scan: { width: number; height: number; faceCount: number; people: { key: string; name: string }[] } | null;
}

export interface ReelReference {
  /** "honoree" or an invitee id. */
  key: string;
  name: string;
  url: string;
}

export async function listReelReferences(eventId: string, honoreeName: string): Promise<ReelReference[]> {
  const client = supabaseAdmin();
  const [{ data: event }, { data: invitees }] = await Promise.all([
    client
      .from("events")
      .select("reel_honoree_photo_path, reel_honoree_consent_at")
      .eq("id", eventId)
      .maybeSingle<{ reel_honoree_photo_path: string | null; reel_honoree_consent_at: string | null }>(),
    client
      .from("invitees")
      .select("id, name, reel_photo_path")
      .eq("event_id", eventId)
      .not("reel_photo_path", "is", null)
      .not("reel_consent_at", "is", null)
      .returns<{ id: string; name: string; reel_photo_path: string }[]>(),
  ]);
  const refs: ReelReference[] = [];
  if (event?.reel_honoree_photo_path && event.reel_honoree_consent_at) {
    refs.push({ key: "honoree", name: honoreeName, url: signedMediaPath("photos", event.reel_honoree_photo_path) });
  }
  for (const inv of invitees ?? []) {
    refs.push({ key: inv.id, name: inv.name, url: signedMediaPath("photos", inv.reel_photo_path) });
  }
  return refs;
}

export async function listReelPool(eventId: string, honoreeName: string): Promise<PoolPhoto[]> {
  const client = supabaseAdmin();
  const [{ data: eventPhotos }, { data: memoryPhotos }, { data: scans }, { data: faces }, { data: invitees }] =
    await Promise.all([
      client
        .from("event_photos")
        .select("id, storage_path, uploaded_by, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .returns<{ id: string; storage_path: string; uploaded_by: "host" | "guest"; created_at: string }[]>(),
      client
        .from("photos")
        .select("id, storage_path, created_at")
        .eq("event_id", eventId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .returns<{ id: string; storage_path: string; created_at: string }[]>(),
      client
        .from("reel_photo_scans")
        .select("id, source, source_id, width, height, face_count")
        .eq("event_id", eventId)
        .returns<{ id: string; source: string; source_id: string; width: number; height: number; face_count: number }[]>(),
      client
        .from("reel_photo_faces")
        .select("scan_id, invitee_id, is_honoree")
        .eq("event_id", eventId)
        .returns<{ scan_id: string; invitee_id: string | null; is_honoree: boolean }[]>(),
      client.from("invitees").select("id, name").eq("event_id", eventId).returns<{ id: string; name: string }[]>(),
    ]);

  const nameOf = new Map((invitees ?? []).map((i) => [i.id, i.name]));
  const peopleByScan = new Map<string, { key: string; name: string }[]>();
  for (const f of faces ?? []) {
    const person = f.is_honoree
      ? { key: "honoree", name: honoreeName }
      : { key: f.invitee_id ?? "", name: nameOf.get(f.invitee_id ?? "") ?? "Guest" };
    peopleByScan.set(f.scan_id, [...(peopleByScan.get(f.scan_id) ?? []), person]);
  }
  const scanOf = new Map((scans ?? []).map((s) => [`${s.source}:${s.source_id}`, s]));
  const toScan = (source: string, id: string) => {
    const s = scanOf.get(`${source}:${id}`);
    return s ? { width: s.width, height: s.height, faceCount: s.face_count, people: peopleByScan.get(s.id) ?? [] } : null;
  };

  return [
    ...(eventPhotos ?? []).map((p) => ({
      source: "event" as const,
      sourceId: p.id,
      url: signedMediaPath("photos", p.storage_path),
      uploadedBy: p.uploaded_by,
      scan: toScan("event", p.id),
    })),
    ...(memoryPhotos ?? []).map((p) => ({
      source: "memory" as const,
      sourceId: p.id,
      url: signedMediaPath("photos", p.storage_path),
      uploadedBy: "guest" as const,
      scan: toScan("memory", p.id),
    })),
  ];
}

export interface ScanFaceInput {
  key: string;
  distance: number;
  box: FaceBox;
}

/** Stores one photo's scan result, replacing any earlier scan of it. `key` = "honoree" | invitee id. */
export async function saveReelPhotoScan(params: {
  eventId: string;
  source: "event" | "memory";
  sourceId: string;
  width: number;
  height: number;
  faceCount: number;
  faces: ScanFaceInput[];
}) {
  const client = supabaseAdmin();
  const table = params.source === "event" ? "event_photos" : "photos";
  const { data: photo } = await client
    .from(table)
    .select("storage_path")
    .eq("id", params.sourceId)
    .eq("event_id", params.eventId)
    .maybeSingle<{ storage_path: string }>();
  if (!photo) throw new Error("Photo not found for this event.");

  // Only keys that really are this event's consenting guests (or the honoree) are accepted.
  const inviteeKeys = Array.from(new Set(params.faces.map((f) => f.key).filter((k) => k !== "honoree")));
  const { data: valid } = inviteeKeys.length
    ? await client
        .from("invitees")
        .select("id")
        .eq("event_id", params.eventId)
        .in("id", inviteeKeys)
        .not("reel_consent_at", "is", null)
        .returns<{ id: string }[]>()
    : { data: [] as { id: string }[] };
  const validIds = new Set((valid ?? []).map((v) => v.id));

  await client.from("reel_photo_scans").delete().eq("source", params.source).eq("source_id", params.sourceId);
  const { data: scan, error } = await client
    .from("reel_photo_scans")
    .insert({
      event_id: params.eventId,
      source: params.source,
      source_id: params.sourceId,
      storage_path: photo.storage_path,
      width: Math.round(params.width),
      height: Math.round(params.height),
      face_count: params.faceCount,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !scan) throw new Error(`Failed to save scan: ${error?.message}`);

  const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  const rows = params.faces
    .filter((f) => f.key === "honoree" || validIds.has(f.key))
    .map((f) => ({
      scan_id: scan.id,
      event_id: params.eventId,
      invitee_id: f.key === "honoree" ? null : f.key,
      is_honoree: f.key === "honoree",
      distance: f.distance,
      box: { x: clamp01(f.box.x), y: clamp01(f.box.y), w: clamp01(f.box.w), h: clamp01(f.box.h) },
    }));
  if (rows.length > 0) {
    const { error: facesError } = await client.from("reel_photo_faces").insert(rows);
    if (facesError) throw new Error(`Failed to save faces: ${facesError.message}`);
  }
}

/** Host correction: "that's not them" — removes one person's match from one photo. */
export async function removeReelFaceMatch(params: {
  eventId: string;
  source: "event" | "memory";
  sourceId: string;
  key: string;
}) {
  const client = supabaseAdmin();
  const { data: scan } = await client
    .from("reel_photo_scans")
    .select("id")
    .eq("event_id", params.eventId)
    .eq("source", params.source)
    .eq("source_id", params.sourceId)
    .maybeSingle<{ id: string }>();
  if (!scan) throw new Error("Photo not found.");
  let query = client.from("reel_photo_faces").delete().eq("scan_id", scan.id);
  query = params.key === "honoree" ? query.eq("is_honoree", true) : query.eq("invitee_id", params.key);
  const { error } = await query;
  if (error) throw new Error(`Failed to remove: ${error.message}`);
}

export async function clearReelScans(eventId: string) {
  const { error } = await supabaseAdmin().from("reel_photo_scans").delete().eq("event_id", eventId);
  if (error) throw new Error(`Failed to reset scans: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Reels                                                                */
/* ------------------------------------------------------------------ */

export interface ReelGuest {
  inviteeId: string;
  name: string;
  token: string;
  phone: string | null;
  photoUrl: string | null;
  consentSource: "guest" | "host" | null;
  togetherCount: number;
  soloCount: number;
  reel: {
    id: string;
    status: ReelStatus;
    videoUrl: string | null;
    shareToken: string;
    error: string | null;
    photoCount: number;
  } | null;
}

interface FaceRow {
  scan_id: string;
  invitee_id: string | null;
  is_honoree: boolean;
  distance: number;
  box: FaceBox;
}

async function loadFaces(eventId: string) {
  const { data, error } = await supabaseAdmin()
    .from("reel_photo_faces")
    .select("scan_id, invitee_id, is_honoree, distance, box")
    .eq("event_id", eventId)
    .returns<FaceRow[]>();
  if (error) throw new Error(`Failed to load faces: ${error.message}`);
  const byScan = new Map<string, FaceRow[]>();
  for (const f of data ?? []) byScan.set(f.scan_id, [...(byScan.get(f.scan_id) ?? []), f]);
  return byScan;
}

export async function listReelGuests(eventId: string): Promise<ReelGuest[]> {
  const client = supabaseAdmin();
  const [{ data: invitees }, { data: reels }, byScan] = await Promise.all([
    client
      .from("invitees")
      .select("id, name, token, phone, reel_photo_path, reel_consent_at, reel_consent_source")
      .eq("event_id", eventId)
      .order("name")
      .returns<
        {
          id: string;
          name: string;
          token: string;
          phone: string | null;
          reel_photo_path: string | null;
          reel_consent_at: string | null;
          reel_consent_source: "guest" | "host" | null;
        }[]
      >(),
    client
      .from("guest_reels")
      .select("id, invitee_id, status, result_path, share_token, error_message, photo_count")
      .eq("event_id", eventId)
      .returns<
        {
          id: string;
          invitee_id: string;
          status: ReelStatus;
          result_path: string | null;
          share_token: string;
          error_message: string | null;
          photo_count: number;
        }[]
      >(),
    loadFaces(eventId),
  ]);

  const together = new Map<string, number>();
  const solo = new Map<string, number>();
  for (const faces of byScan.values()) {
    const hasHonoree = faces.some((f) => f.is_honoree);
    for (const id of new Set(faces.map((f) => f.invitee_id).filter((x): x is string => Boolean(x)))) {
      const target = hasHonoree ? together : solo;
      target.set(id, (target.get(id) ?? 0) + 1);
    }
  }
  const reelOf = new Map((reels ?? []).map((r) => [r.invitee_id, r]));

  return (invitees ?? []).map((inv) => {
    const reel = reelOf.get(inv.id);
    return {
      inviteeId: inv.id,
      name: inv.name,
      token: inv.token,
      phone: inv.phone,
      photoUrl: inv.reel_photo_path && inv.reel_consent_at ? signedMediaPath("photos", inv.reel_photo_path) : null,
      consentSource: inv.reel_consent_at ? inv.reel_consent_source : null,
      togetherCount: together.get(inv.id) ?? 0,
      soloCount: solo.get(inv.id) ?? 0,
      reel: reel
        ? {
            id: reel.id,
            status: reel.status,
            videoUrl: reel.result_path ? signedMediaPath("videos", reel.result_path) : null,
            shareToken: reel.share_token,
            error: reel.error_message,
            photoCount: reel.photo_count,
          }
        : null,
    };
  });
}

export async function countReelRenders(eventId: string): Promise<number> {
  const { data } = await supabaseAdmin()
    .from("guest_reels")
    .select("render_count")
    .eq("event_id", eventId)
    .returns<{ render_count: number }[]>();
  return (data ?? []).reduce((sum, r) => sum + r.render_count, 0);
}

/** Template accent for names/rules; very dark accents (e.g. Minimal White's near-black) fall back to gold so text stays visible on the dark outro. */
function reelTheme(templateSlug: string) {
  const template = getTemplateBySlug(templateSlug);
  const hex = template.primaryColor.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { accent: luminance < 0.25 || Number.isNaN(luminance) ? "#d4af37" : template.primaryColor, dark: "#0f1424" };
}

export type QueueReelResult = { ok: true; reelId: string } | { ok: false; reason: string };

/**
 * Builds the guest's reel edit from their face matches and stores it on
 * guest_reels (creating or resetting the row) with status "queued". The
 * caller then asks the Edge Function to submit it.
 */
export async function queueGuestReel(event: EventRecord, inviteeId: string, adminId: string | null): Promise<QueueReelResult> {
  const client = supabaseAdmin();
  const [{ data: invitee }, { data: eventRow }, byScan, { data: scans }] = await Promise.all([
    client
      .from("invitees")
      .select("id, name, event_id, reel_consent_at")
      .eq("id", inviteeId)
      .maybeSingle<{ id: string; name: string; event_id: string; reel_consent_at: string | null }>(),
    client
      .from("events")
      .select("reel_honoree_photo_path, reel_honoree_consent_at, reel_music")
      .eq("id", event.id)
      .maybeSingle<{ reel_honoree_photo_path: string | null; reel_honoree_consent_at: string | null; reel_music: string }>(),
    loadFaces(event.id),
    client
      .from("reel_photo_scans")
      .select("id, storage_path, width, height")
      .eq("event_id", event.id)
      .returns<{ id: string; storage_path: string; width: number; height: number }[]>(),
  ]);
  if (!invitee || invitee.event_id !== event.id) return { ok: false, reason: "Guest not found." };
  if (!invitee.reel_consent_at) return { ok: false, reason: `${invitee.name} hasn't agreed to a reel yet.` };

  const scanInfo = new Map((scans ?? []).map((s) => [s.id, s]));
  type Candidate = { scanId: string; kind: ReelPhoto["kind"]; focus: FaceBox[]; score: number };
  const candidates: Candidate[] = [];
  for (const [scanId, faces] of byScan) {
    const mine = faces.filter((f) => f.invitee_id === inviteeId);
    const honoree = faces.filter((f) => f.is_honoree);
    if (mine.length > 0) {
      const kind = honoree.length > 0 ? "together" : "guest";
      const focus = [...mine, ...honoree].map((f) => f.box);
      // Prefer confident matches and photos where the faces are big (close-ups read better on a phone).
      const size = Math.max(...mine.map((f) => f.box.w * f.box.h));
      candidates.push({ scanId, kind, focus, score: Math.min(...mine.map((f) => f.distance)) - size });
    } else if (honoree.length > 0) {
      candidates.push({
        scanId,
        kind: "honoree",
        focus: honoree.map((f) => f.box),
        score: Math.min(...honoree.map((f) => f.distance)) + (faces.length > 2 ? 0 : 0.2),
      });
    }
  }
  if (!candidates.some((c) => c.kind !== "honoree")) {
    return { ok: false, reason: `${invitee.name} wasn't found in any photo yet.` };
  }
  candidates.sort((a, b) => a.score - b.score);

  const ttl = 3 * 24 * 60 * 60;
  const photos: ReelPhoto[] = [];
  for (const c of candidates) {
    const scan = scanInfo.get(c.scanId);
    if (!scan) continue;
    photos.push({
      url: await externalMediaUrl(PHOTO_BUCKET, scan.storage_path, ttl),
      width: scan.width,
      height: scan.height,
      focus: c.focus,
      kind: c.kind,
    });
    if (photos.length >= 24) break;
  }

  let honoreePhoto: ReelPhoto | null = null;
  // The intro uses the best photo of the guest of honour from the day, else their reference photo.
  const bestHonoree = candidates.find((c) => c.kind === "honoree");
  const bestHonoreeScan = bestHonoree ? scanInfo.get(bestHonoree.scanId) : undefined;
  if (bestHonoree && bestHonoreeScan) {
    honoreePhoto = {
      url: await externalMediaUrl(PHOTO_BUCKET, bestHonoreeScan.storage_path, ttl),
      width: bestHonoreeScan.width,
      height: bestHonoreeScan.height,
      focus: bestHonoree.focus,
      kind: "honoree",
    };
  } else if (eventRow?.reel_honoree_photo_path && eventRow.reel_honoree_consent_at) {
    // Reference photos are portrait selfies in practice — unknown size, so no face-aware crop.
    honoreePhoto = {
      url: await externalMediaUrl(PHOTO_BUCKET, eventRow.reel_honoree_photo_path, ttl),
      width: 0,
      height: 0,
      focus: [],
      kind: "honoree",
    };
  }

  const music = REEL_MUSIC[resolveReelMusic(eventRow?.reel_music)];
  const { edit, durationSeconds, photoCount } = buildGuestReelEdit({
    guestName: invitee.name,
    honoreeName: event.honoreeName,
    hostedBy: event.hostedBy || null,
    occasionLine: event.occasion || event.eventTitle,
    dateLine: formatEventDate(event.startAt, event.timezone),
    honoreePhoto,
    photos,
    musicUrl: music.url,
    theme: reelTheme(event.templateSlug),
    siteLabel: new URL(SITE_URL).host,
  });

  const { data: existing } = await client
    .from("guest_reels")
    .select("id, render_count, result_path")
    .eq("invitee_id", inviteeId)
    .maybeSingle<{ id: string; render_count: number; result_path: string | null }>();

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await client
      .from("guest_reels")
      .update({
        status: "queued",
        edit,
        duration_seconds: durationSeconds,
        photo_count: photoCount,
        shotstack_render_id: null,
        error_message: null,
        render_count: existing.render_count + 1,
        created_by: adminId,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to queue reel: ${error.message}`);
    // The old video stays visible until the new one replaces it (result_path is swapped by the Edge Function).
    return { ok: true, reelId: existing.id };
  }

  const { data: created, error } = await client
    .from("guest_reels")
    .insert({
      event_id: event.id,
      invitee_id: inviteeId,
      status: "queued",
      edit,
      duration_seconds: durationSeconds,
      photo_count: photoCount,
      share_token: randomBytes(12).toString("base64url"),
      created_by: adminId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) throw new Error(`Failed to queue reel: ${error?.message}`);
  return { ok: true, reelId: created.id };
}

/** Asks the Edge Function to submit (action "submit") or check (action "status") a reel render. */
export async function invokeReelRender(reelId: string, action: "submit" | "status") {
  const { data, error } = await supabaseAdmin().functions.invoke<{ success: boolean; status?: ReelStatus; error?: string }>(
    "guest-reel-render",
    { body: { reelId, action } },
  );
  if (error) return { success: false as const, error: error.message };
  return data ?? { success: false as const, error: "No response from the renderer." };
}

export interface PublicReel {
  reelId: string;
  status: ReelStatus;
  videoUrl: string | null;
  shareToken: string;
  guestName: string;
  eventId: string;
  updatedAt: string;
}

async function loadReel(column: "invitee_id" | "share_token", value: string): Promise<PublicReel | null> {
  const { data } = await supabaseAdmin()
    .from("guest_reels")
    .select("id, status, result_path, share_token, event_id, updated_at, invitees(name)")
    .eq(column, value)
    .maybeSingle<{
      id: string;
      status: ReelStatus;
      result_path: string | null;
      share_token: string;
      event_id: string;
      updated_at: string;
      invitees: { name: string } | null;
    }>();
  if (!data) return null;
  return {
    reelId: data.id,
    status: data.status,
    videoUrl: data.result_path ? signedMediaPath("videos", data.result_path) : null,
    shareToken: data.share_token,
    guestName: data.invitees?.name ?? "Guest",
    eventId: data.event_id,
    updatedAt: data.updated_at,
  };
}

export function getGuestReelForInvitee(inviteeId: string) {
  return loadReel("invitee_id", inviteeId);
}

export function getGuestReelByShareToken(shareToken: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(shareToken)) return Promise.resolve(null);
  return loadReel("share_token", shareToken);
}

/** For the guest's own invite page: whether they've opted in, and their photo. */
export async function getInviteeReelOptIn(inviteeId: string) {
  const { data } = await supabaseAdmin()
    .from("invitees")
    .select("reel_photo_path, reel_consent_at")
    .eq("id", inviteeId)
    .maybeSingle<{ reel_photo_path: string | null; reel_consent_at: string | null }>();
  return {
    optedIn: Boolean(data?.reel_photo_path && data.reel_consent_at),
    photoUrl: data?.reel_photo_path && data.reel_consent_at ? signedMediaPath("photos", data.reel_photo_path) : null,
  };
}

export { VIDEO_BUCKET as GUEST_REEL_VIDEO_BUCKET };
