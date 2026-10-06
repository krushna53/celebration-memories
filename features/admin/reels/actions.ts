"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { UploadValidationError } from "@/services/uploads";
import {
  clearReelScans,
  confirmEventPhoto,
  countReelRenders,
  createSignedEventPhotoUpload,
  createSignedReelFaceUpload,
  deleteEventPhoto,
  getReelSettings,
  invokeReelRender,
  listReelGuests,
  queueGuestReel,
  removeReelFaceMatch,
  saveReelPhotoScan,
  setHonoreeReelPhoto,
  setInviteeReelPhoto,
  updateReelSettings,
  type ReelGuest,
  type ScanFaceInput,
} from "@/services/guest-reels";

type Result<T = undefined> = T extends undefined ? { success: true } | { success: false; error: string } : { success: true; data: T } | { success: false; error: string };

interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  viewUrl: string;
}

function fail(err: unknown, fallback = "Something went wrong."): { success: false; error: string } {
  if (err instanceof UploadValidationError) return { success: false, error: err.message };
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

const PATH = "/admin/reels";

export async function updateReelSettingsAction(eventId: string, input: { enabled?: boolean; music?: string }): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await updateReelSettings(eventId, input);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/** owner = "honoree" for the guest-of-honour photo, or an invitee id. */
export async function requestReelFaceUploadAction(
  eventId: string,
  owner: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<Result<SignedUpload>> {
  try {
    await requireAdminForEvent(eventId);
    const data = await createSignedReelFaceUpload({ eventId, owner, fileName, contentType, fileSize, audience: "host" });
    return { success: true, data };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Saves the guest-of-honour photo. `consent` must be true — the host is
 * confirming the guest of honour agreed to their photo being used to
 * find them in event photos for guests' reels.
 */
export async function saveHonoreeReelPhotoAction(eventId: string, path: string | null, consent: boolean): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    if (path && !consent) return { success: false, error: "Please confirm the guest of honour has agreed first." };
    await setHonoreeReelPhoto(eventId, path);
    revalidatePath(PATH);
    revalidatePath("/admin/event-settings");
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/** Host adds/removes a guest's photo — only with the host's confirmation that the guest agreed. */
export async function saveInviteeReelPhotoAction(
  eventId: string,
  inviteeId: string,
  path: string | null,
  consent: boolean,
): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    if (path && !consent) return { success: false, error: "Please confirm this guest has agreed first." };
    await setInviteeReelPhoto({ eventId, inviteeId, path, source: "host" });
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export async function requestEventPhotoUploadAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<Result<SignedUpload>> {
  try {
    await requireAdminForEvent(eventId);
    const data = await createSignedEventPhotoUpload({ eventId, inviteeId: null, fileName, contentType, fileSize });
    return { success: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmEventPhotoAction(eventId: string, path: string): Promise<Result<{ id: string; url: string }>> {
  try {
    await requireAdminForEvent(eventId);
    const data = await confirmEventPhoto({ eventId, inviteeId: null, path });
    return { success: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteEventPhotoAction(eventId: string, photoId: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await deleteEventPhoto({ eventId, photoId });
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export async function saveReelScanAction(
  eventId: string,
  scan: { source: "event" | "memory"; sourceId: string; width: number; height: number; faceCount: number; faces: ScanFaceInput[] },
): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await saveReelPhotoScan({ eventId, ...scan });
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export async function removeReelFaceMatchAction(
  eventId: string,
  source: "event" | "memory",
  sourceId: string,
  key: string,
): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await removeReelFaceMatch({ eventId, source, sourceId, key });
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export async function resetReelScansAction(eventId: string): Promise<Result> {
  try {
    await requireAdminForEvent(eventId);
    await clearReelScans(eventId);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export interface GenerateReelsOutcome {
  queued: number;
  skipped: { name: string; reason: string }[];
}

/**
 * Queues and submits reels for the given guests. Client-role admins are
 * capped per event (events.guest_reel_render_limit, counting every
 * render including re-renders) because each reel is a paid Shotstack
 * render (~30 s ≈ $0.20 at pay-as-you-go rates); the owner is exempt.
 */
export async function generateReelsAction(eventId: string, inviteeIds: string[]): Promise<Result<GenerateReelsOutcome>> {
  try {
    const admin = await requireAdminForEvent(eventId);
    const event = await getEventById(eventId);
    if (!event) return { success: false, error: "Event not found." };

    const ids = Array.from(new Set(inviteeIds)).slice(0, 200);
    let allowance = Infinity;
    if (admin.role !== "owner") {
      const settings = await getReelSettings(eventId);
      allowance = Math.max(0, settings.renderLimit - (await countReelRenders(eventId)));
      if (allowance === 0) {
        return { success: false, error: `You've used all ${settings.renderLimit} reel renders for this event. Contact us to raise the limit.` };
      }
    }

    const outcome: GenerateReelsOutcome = { queued: 0, skipped: [] };
    const names = new Map((await listReelGuests(eventId)).map((g) => [g.inviteeId, g.name]));
    for (const inviteeId of ids) {
      const name = names.get(inviteeId) ?? "Guest";
      if (outcome.queued >= allowance) {
        outcome.skipped.push({ name, reason: "render limit reached" });
        continue;
      }
      const queued = await queueGuestReel(event, inviteeId, admin.id);
      if (!queued.ok) {
        outcome.skipped.push({ name, reason: queued.reason });
        continue;
      }
      const submitted = await invokeReelRender(queued.reelId, "submit");
      if (!submitted.success || submitted.status === "error") {
        outcome.skipped.push({ name, reason: submitted.error ?? "the renderer rejected it" });
        continue;
      }
      outcome.queued += 1;
    }
    revalidatePath(PATH);
    return { success: true, data: outcome };
  } catch (err) {
    return fail(err);
  }
}

/** Polled by the page while any reel is rendering — checks each one with Shotstack and returns fresh guest rows. */
export async function pollReelsAction(eventId: string): Promise<Result<ReelGuest[]>> {
  try {
    await requireAdminForEvent(eventId);
    const before = await listReelGuests(eventId);
    const rendering = before.filter((g) => g.reel && (g.reel.status === "rendering" || g.reel.status === "queued"));
    // A few at a time — each status check may also copy a finished MP4 into Storage.
    for (let i = 0; i < rendering.length; i += 4) {
      await Promise.all(rendering.slice(i, i + 4).map((g) => invokeReelRender(g.reel!.id, "status")));
    }
    return { success: true, data: rendering.length ? await listReelGuests(eventId) : before };
  } catch (err) {
    return fail(err);
  }
}
