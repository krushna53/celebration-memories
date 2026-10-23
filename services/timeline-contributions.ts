import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import {
  addMilestonePhotos,
  createMilestone,
  getMilestoneById,
  listMilestones,
  updateMilestone,
  type NewMilestonePhoto,
} from "@/services/timeline";

/**
 * Guests contributing photos to the Timeline — the page at
 * /events/[slug]/timeline/share. A guest (identified by their invite
 * token, or a public-page token minted from their name, same as public
 * memory uploads) submits photos for one of the host's milestones, or a
 * memory that isn't on the Timeline yet. Nothing is shown publicly until
 * the host approves it in Admin → Timeline; approving copies the photos
 * onto a milestone as extra photos credited "Shared by …".
 *
 * Off by default per event (events.timeline_contributions_enabled).
 */

/** Photos per submission, and how many unreviewed submissions one guest can have waiting. */
export const MAX_SUBMISSION_PHOTOS = 20;
const MAX_PENDING_PER_GUEST = 10;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function areTimelineContributionsEnabled(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("events")
    .select("timeline_contributions_enabled")
    .eq("id", eventId)
    .maybeSingle<{ timeline_contributions_enabled: boolean | null }>();
  return data?.timeline_contributions_enabled === true;
}

export async function setTimelineContributionsEnabled(eventId: string, enabled: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("events").update({ timeline_contributions_enabled: enabled }).eq("id", eventId);
  if (error) throw new Error(`Failed to update setting: ${error.message}`);
}

/** What a guest sees to pick from: the host's milestones, no private fields. */
export interface PublicMilestoneOption {
  id: string;
  period: string;
  title: string;
  coverUrl: string | null;
}

export async function listMilestoneOptions(eventId: string): Promise<PublicMilestoneOption[]> {
  const milestones = await listMilestones(eventId);
  return milestones.map((m) => ({
    id: m.id,
    period: m.period,
    title: m.title,
    coverUrl: m.imageUrl && !/\.mp4(\?|$)/i.test(m.imageUrl) ? m.imageUrl : null,
  }));
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function coord(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max ? value : null;
}

export interface SubmissionInput {
  milestoneId?: string | null;
  period?: string | null;
  title?: string | null;
  story?: string | null;
  photos: NewMilestonePhoto[];
}

/**
 * Records a guest's submission. `event` and `invitee` were resolved from
 * the guest's token by the caller; everything else came from the browser
 * and is re-checked here.
 */
export async function createSubmission(
  eventId: string,
  invitee: { id: string; name: string },
  input: SubmissionInput,
): Promise<void> {
  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length === 0) throw new Error("Please add at least one photo.");
  if (photos.length > MAX_SUBMISSION_PHOTOS) throw new Error(`Please share up to ${MAX_SUBMISSION_PHOTOS} photos at a time.`);
  // Only files uploaded through this page's own signed URLs, for this event.
  for (const p of photos) {
    if (
      typeof p.path !== "string" ||
      !p.path.startsWith(`${eventId}/timeline/contrib-`) ||
      p.path.includes("..") ||
      p.path.includes("\\")
    ) {
      throw new Error("One of the photos didn't upload properly — please try again.");
    }
  }

  let milestoneId: string | null = null;
  if (input.milestoneId) {
    const milestone = await getMilestoneById(input.milestoneId);
    if (!milestone || milestone.eventId !== eventId) throw new Error("That memory isn't on this timeline any more — please pick again.");
    milestoneId = milestone.id;
  } else if (!text(input.title, 120)) {
    throw new Error("Please say briefly what this memory is.");
  }

  const client = supabaseAdmin();
  const { count, error: countError } = await client
    .from("timeline_submissions")
    .select("id", { count: "exact", head: true })
    .eq("invitee_id", invitee.id)
    .eq("status", "pending");
  if (countError) throw new Error("Something went wrong. Please try again.");
  if ((count ?? 0) >= MAX_PENDING_PER_GUEST) {
    throw new Error("You've shared a lot already — thank you! Please wait until the family has looked through them.");
  }

  const { data: submission, error } = await client
    .from("timeline_submissions")
    .insert({
      event_id: eventId,
      invitee_id: invitee.id,
      contributor_name: invitee.name.slice(0, 100),
      milestone_id: milestoneId,
      proposed_period: milestoneId ? null : text(input.period, 60),
      proposed_title: milestoneId ? null : text(input.title, 120),
      story: text(input.story, 1000),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !submission) throw new Error("Something went wrong. Please try again.");

  const rows = photos.map((p) => {
    const lat = coord(p.lat, 90);
    const lon = coord(p.lon, 180);
    return {
      submission_id: submission.id,
      event_id: eventId,
      storage_path: p.path,
      original_name: text(p.originalName, 200),
      taken_at: typeof p.takenAt === "string" && STAMP.test(p.takenAt) ? p.takenAt : null,
      lat: lat !== null && lon !== null ? lat : null,
      lon: lat !== null && lon !== null ? lon : null,
      fingerprint: typeof p.fingerprint === "string" && /^[A-Za-z0-9:._-]{1,120}$/.test(p.fingerprint) ? p.fingerprint : null,
    };
  });
  const { error: photoError } = await client.from("timeline_submission_photos").insert(rows);
  if (photoError) {
    await client.from("timeline_submissions").delete().eq("id", submission.id);
    throw new Error("Something went wrong. Please try again.");
  }
}

export interface SubmissionPhoto {
  id: string;
  url: string;
  path: string;
  originalName: string | null;
  takenAt: string | null;
  lat: number | null;
  lon: number | null;
  fingerprint: string | null;
}

export interface PendingSubmission {
  id: string;
  contributorName: string;
  milestoneId: string | null;
  proposedPeriod: string | null;
  proposedTitle: string | null;
  story: string | null;
  createdAt: string;
  photos: SubmissionPhoto[];
}

interface SubmissionRow {
  id: string;
  contributor_name: string;
  milestone_id: string | null;
  proposed_period: string | null;
  proposed_title: string | null;
  story: string | null;
  created_at: string;
  timeline_submission_photos: {
    id: string;
    storage_path: string;
    original_name: string | null;
    taken_at: string | null;
    lat: number | null;
    lon: number | null;
    fingerprint: string | null;
  }[];
}

export async function listPendingSubmissions(eventId: string): Promise<PendingSubmission[]> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_submissions")
    .select(
      "id, contributor_name, milestone_id, proposed_period, proposed_title, story, created_at, timeline_submission_photos(id, storage_path, original_name, taken_at, lat, lon, fingerprint)",
    )
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<SubmissionRow[]>();
  if (error) throw new Error(`Failed to load guest contributions: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    contributorName: row.contributor_name,
    milestoneId: row.milestone_id,
    proposedPeriod: row.proposed_period,
    proposedTitle: row.proposed_title,
    story: row.story,
    createdAt: row.created_at,
    photos: row.timeline_submission_photos
      .map((p) => ({
        id: p.id,
        url: publicMediaUrl("gallery", p.storage_path),
        path: p.storage_path,
        originalName: p.original_name,
        takenAt: p.taken_at ? p.taken_at.slice(0, 16) : null,
        lat: p.lat,
        lon: p.lon,
        fingerprint: p.fingerprint,
      }))
      .sort((a, b) => (a.takenAt ?? "9999").localeCompare(b.takenAt ?? "9999")),
  }));
}

async function getPendingSubmission(id: string, eventId: string): Promise<PendingSubmission | null> {
  const all = await listPendingSubmissions(eventId);
  return all.find((s) => s.id === id) ?? null;
}

export async function getSubmissionEventId(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("timeline_submissions").select("event_id").eq("id", id).maybeSingle<{ event_id: string }>();
  return data?.event_id ?? null;
}

async function removeFiles(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin().storage.from("gallery").remove(paths);
  if (error) console.error("timeline contributions: couldn't remove files:", error.message);
}

async function markReviewed(id: string, status: "approved" | "rejected") {
  const { error } = await supabaseAdmin()
    .from("timeline_submissions")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(`Failed to update contribution: ${error.message}`);
}

export interface ApproveInput {
  /** Existing milestone to add the photos to, or null to create a new milestone from them. */
  milestoneId: string | null;
  /** New milestone only. */
  period?: string;
  title?: string;
  description?: string;
  /** Photos the host kept; the rest are deleted. */
  photoIds: string[];
}

/**
 * Approves a guest's submission: the kept photos become extra photos on
 * the chosen milestone (credited to the guest), or a new milestone whose
 * main photo is the first kept photo. Photos the host unticked are
 * deleted from storage.
 */
export async function approveSubmission(eventId: string, submissionId: string, input: ApproveInput): Promise<void> {
  const submission = await getPendingSubmission(submissionId, eventId);
  if (!submission) throw new Error("This contribution has already been reviewed.");
  const keep = new Set(input.photoIds);
  const kept = submission.photos.filter((p) => keep.has(p.id));
  const dropped = submission.photos.filter((p) => !keep.has(p.id));
  if (kept.length === 0) throw new Error("Keep at least one photo, or reject the contribution instead.");

  const asNew = (p: SubmissionPhoto): NewMilestonePhoto => ({
    path: p.path,
    originalName: p.originalName,
    takenAt: p.takenAt,
    lat: p.lat,
    lon: p.lon,
    fingerprint: p.fingerprint,
    contributedBy: submission.contributorName,
  });

  if (input.milestoneId) {
    const milestone = await getMilestoneById(input.milestoneId);
    if (!milestone || milestone.eventId !== eventId) throw new Error("That milestone no longer exists.");
    await addMilestonePhotos(milestone, kept.map(asNew));
  } else {
    const period = input.period?.trim() ?? "";
    const title = input.title?.trim() ?? "";
    const description = input.description?.trim() ?? "";
    if (!period || !title || !description) throw new Error("A new milestone needs a period, title and description.");
    const days = kept.map((p) => p.takenAt?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort();
    const gps = kept.find((p) => p.lat !== null && p.lon !== null);
    const [cover, ...rest] = kept;
    const existing = await listMilestones(eventId);
    const id = await createMilestone({
      eventId,
      period: period.slice(0, 60),
      title: title.slice(0, 120),
      description: description.slice(0, 1000),
      sortOrder: existing.length,
      meta: {
        takenFrom: days[0] ?? null,
        takenTo: days[days.length - 1] ?? null,
        lat: gps?.lat ?? null,
        lon: gps?.lon ?? null,
        imageFingerprint: cover?.fingerprint ?? null,
      },
    });
    if (cover) await updateMilestone(id, { imagePath: cover.path, imageFingerprint: cover.fingerprint });
    const milestone = await getMilestoneById(id);
    if (milestone && rest.length) await addMilestonePhotos(milestone, rest.map(asNew));
  }

  await markReviewed(submissionId, "approved");
  await removeFiles(dropped.map((p) => p.path));
}

/** Rejects a submission and deletes its photos — they were never public. */
export async function rejectSubmission(eventId: string, submissionId: string): Promise<void> {
  const submission = await getPendingSubmission(submissionId, eventId);
  if (!submission) throw new Error("This contribution has already been reviewed.");
  await markReviewed(submissionId, "rejected");
  await removeFiles(submission.photos.map((p) => p.path));
}
