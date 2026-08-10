import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

/**
 * Recycle Bin — soft-delete for the four media tables that hold a real
 * Storage object (gallery_photos, photos, videos, audio; guestbook is
 * text, not media, and stays a hard delete). See migration
 * 0038_media_recycle_bin.sql for the deleted_at column + partial
 * indexes this is built on.
 *
 * "Delete" in the normal admin UI (Gallery, Memories moderation queue)
 * now calls moveToTrash instead of a hard delete — see
 * features/admin/gallery/actions.ts's deleteGalleryPhotoAction and
 * features/admin/memories/actions.ts's deleteMemoryAction. Every other
 * read query across the app (listGalleryPhotos, getCoverPhoto,
 * getMemoryWallItems, listMemoriesForModeration, getPublicMediaItem,
 * the Video Editor's media bin) filters `.is("deleted_at", null)` so a
 * trashed item disappears from every normal listing immediately.
 */

export type RecycleBinKind = "gallery" | "photo" | "video" | "audio";

export const RECYCLE_BIN_KINDS: readonly RecycleBinKind[] = ["gallery", "photo", "video", "audio"];

export const TRASH_RETENTION_DAYS = 30;

const TABLE: Record<RecycleBinKind, string> = {
  gallery: "gallery_photos",
  photo: "photos",
  video: "videos",
  audio: "audio",
};

const BUCKET: Record<RecycleBinKind, string> = {
  gallery: "gallery",
  photo: "photos",
  video: "videos",
  audio: "audio",
};

const KIND_LABEL: Record<RecycleBinKind, string> = {
  gallery: "Gallery photo",
  photo: "Memory Wall photo",
  video: "Memory Wall video",
  audio: "Memory Wall audio",
};

export interface TrashItem {
  id: string;
  kind: RecycleBinKind;
  kindLabel: string;
  eventId: string;
  url: string | null;
  caption: string | null;
  guestName: string | null;
  deletedAt: string;
  /** deletedAt + TRASH_RETENTION_DAYS — when the automatic purge sweep will permanently remove this item. */
  purgeAt: string;
  createdAt: string;
}

/**
 * Looks up which event a media item belongs to, WITHOUT filtering on
 * deleted_at — deliberately different from getGalleryPhotoById /
 * getMemoryEventId (which only resolve non-trashed items), since
 * restore/purge/moveToTrash all need to authorize against an item that
 * may already be trashed.
 */
export async function getRecycleItemEventId(kind: RecycleBinKind, id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from(TABLE[kind])
    .select("event_id")
    .eq("id", id)
    .maybeSingle<{ event_id: string }>();

  if (error) {
    console.error(`getRecycleItemEventId(${kind}) failed:`, error.message);
    return null;
  }
  return data?.event_id ?? null;
}

export async function moveToTrash(kind: RecycleBinKind, id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from(TABLE[kind])
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to move to trash: ${error.message}`);
}

export async function restoreFromTrash(kind: RecycleBinKind, id: string): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE[kind]).update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(`Failed to restore: ${error.message}`);
}

/** Permanently removes a trashed item — the Storage object plus its row. Used by both the admin's "Delete Forever" action and the automatic daily purge sweep. */
export async function purgeItem(kind: RecycleBinKind, id: string): Promise<void> {
  const client = supabaseAdmin();
  const { data } = await client
    .from(TABLE[kind])
    .select("storage_path")
    .eq("id", id)
    .maybeSingle<{ storage_path: string }>();

  if (data?.storage_path) {
    await client.storage.from(BUCKET[kind]).remove([data.storage_path]);
  }

  const { error } = await client.from(TABLE[kind]).delete().eq("id", id);
  if (error) throw new Error(`Failed to permanently delete: ${error.message}`);
}

interface TrashRow {
  id: string;
  event_id: string;
  storage_path: string | null;
  caption: string | null;
  deleted_at: string;
  created_at: string;
  invitees?: { name: string } | null;
}

function purgeAtFor(deletedAt: string): string {
  return new Date(new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function listTrash(eventId: string): Promise<TrashItem[]> {
  const results = await Promise.all(
    RECYCLE_BIN_KINDS.map(async (kind) => {
      // gallery_photos has no invitees FK (admin-curated, not guest-uploaded).
      const selectCols = kind === "gallery" ? "*" : "*, invitees(name)";
      const { data, error } = await supabaseAdmin()
        .from(TABLE[kind])
        .select(selectCols)
        .eq("event_id", eventId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error(`listTrash(${kind}) failed:`, error.message);
        return [];
      }

      return (data as unknown as TrashRow[]).map(
        (row): TrashItem => ({
          id: row.id,
          kind,
          kindLabel: KIND_LABEL[kind],
          eventId: row.event_id,
          url: row.storage_path ? publicMediaUrl(BUCKET[kind], row.storage_path) : null,
          caption: row.caption ?? null,
          guestName: row.invitees?.name ?? null,
          deletedAt: row.deleted_at,
          purgeAt: purgeAtFor(row.deleted_at),
          createdAt: row.created_at,
        }),
      );
    }),
  );

  return results.flat().sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

/**
 * Daily sweep — permanently deletes anything trashed more than
 * TRASH_RETENTION_DAYS ago. Called by the purge-expired-trash Edge
 * Function on a pg_cron schedule (see migration
 * 0039_media_recycle_bin_cron.sql), mirroring the existing
 * guest-reminder-push-dispatch cron pattern (0024_guest_reminder_cron.sql).
 */
export async function purgeExpiredTrash(): Promise<{ purged: number; errors: string[] }> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;
  const errors: string[] = [];

  for (const kind of RECYCLE_BIN_KINDS) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE[kind])
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (error) {
      errors.push(`${kind}: list failed (${error.message})`);
      continue;
    }

    for (const row of (data ?? []) as { id: string }[]) {
      try {
        await purgeItem(kind, row.id);
        purged += 1;
      } catch (err) {
        errors.push(`${kind} ${row.id}: ${err instanceof Error ? err.message : "purge failed"}`);
      }
    }
  }

  return { purged, errors };
}
