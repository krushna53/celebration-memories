import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import { getEventById } from "@/services/events";
import { generateDraftToken } from "@/lib/tokens";
import type { MediaLibraryKind } from "@/services/media-library";
import type { EventRecord } from "@/types/event";

/**
 * Multi-select "Share Collection" links (#83) — bundles several Media
 * Library items (any mix of kinds) behind one shareable, no-login
 * public link (/share/[token]). Extends task #80's per-item /p/[kind]/[id]
 * pattern to a whole selection at once. See migration
 * 0040_share_collections.sql's header comment for why items are stored
 * as bare (kind, item_id) pairs rather than foreign keys.
 */

const TABLE: Record<MediaLibraryKind, string> = {
  gallery: "gallery_photos",
  photo: "photos",
  video: "videos",
  audio: "audio",
  ai_image: "ai_image_jobs",
  slideshow_video: "slideshow_video_jobs",
  video_edit: "video_edit_jobs",
};

const BUCKET: Record<MediaLibraryKind, string> = {
  gallery: "gallery",
  photo: "photos",
  video: "videos",
  audio: "audio",
  ai_image: "gallery",
  slideshow_video: "gallery",
  video_edit: "gallery",
};

const PATH_COLUMN: Record<MediaLibraryKind, string> = {
  gallery: "storage_path",
  photo: "storage_path",
  video: "storage_path",
  audio: "storage_path",
  ai_image: "result_path",
  slideshow_video: "result_path",
  video_edit: "result_path",
};

export interface ShareCollectionInputItem {
  kind: MediaLibraryKind;
  id: string;
}

/** Ownership-checks every item against eventId before saving — an admin can only bundle items that actually belong to the event they're managing. Silently drops any item that doesn't resolve (already deleted, wrong event) rather than failing the whole collection. */
export async function createShareCollection(params: {
  eventId: string;
  adminId: string | null;
  title: string | null;
  items: ShareCollectionInputItem[];
}): Promise<string> {
  const client = supabaseAdmin();

  const byKind = new Map<MediaLibraryKind, string[]>();
  for (const item of params.items) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item.id);
    byKind.set(item.kind, list);
  }

  const validIds = new Set<string>(); // `${kind}:${id}`
  await Promise.all(
    Array.from(byKind.entries()).map(async ([kind, ids]) => {
      const { data, error } = await client.from(TABLE[kind]).select("id, event_id").in("id", ids);
      if (error) {
        console.error(`createShareCollection: lookup failed for ${kind}:`, error.message);
        return;
      }
      for (const row of (data ?? []) as Array<{ id: string; event_id: string }>) {
        if (row.event_id === params.eventId) validIds.add(`${kind}:${row.id}`);
      }
    }),
  );

  const validItems = params.items.filter((it) => validIds.has(`${it.kind}:${it.id}`));
  if (validItems.length === 0) throw new Error("None of the selected items could be shared.");

  const token = generateDraftToken();
  const { data: collection, error: insertError } = await client
    .from("share_collections")
    .insert({ event_id: params.eventId, token, title: params.title, created_by: params.adminId })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !collection) throw new Error(`Failed to create share link: ${insertError?.message}`);

  const { error: itemsError } = await client.from("share_collection_items").insert(
    validItems.map((it, i) => ({
      collection_id: collection.id,
      kind: it.kind,
      item_id: it.id,
      sort_order: i,
    })),
  );
  if (itemsError) throw new Error(`Failed to save share link items: ${itemsError.message}`);

  return token;
}

export interface ShareCollectionResolvedItem {
  kind: MediaLibraryKind;
  id: string;
  url: string;
  caption: string | null;
}

export interface ShareCollection {
  id: string;
  title: string | null;
  createdAt: string;
  event: EventRecord;
  items: ShareCollectionResolvedItem[];
}

interface CaptionRow {
  id: string;
  caption?: string | null;
  prompt?: string | null;
  title?: string | null;
  [pathColumn: string]: unknown;
}

/**
 * Re-resolves every item fresh from its real table rather than trusting
 * anything cached — a deleted/trashed item quietly drops out of the
 * bundle instead of breaking the whole page. Guest-uploaded kinds
 * (photo/video/audio) are additionally gated on `approved = true`, same
 * as the public Memory Wall/`/p/[kind]/[id]`, in case something was
 * unapproved after the collection was created.
 */
export async function getShareCollectionByToken(token: string): Promise<ShareCollection | null> {
  const client = supabaseAdmin();

  const { data: collection, error } = await client
    .from("share_collections")
    .select("id, event_id, title, created_at")
    .eq("token", token)
    .maybeSingle<{ id: string; event_id: string; title: string | null; created_at: string }>();

  if (error || !collection) return null;

  const event = await getEventById(collection.event_id);
  if (!event) return null;

  const { data: itemRows, error: itemsError } = await client
    .from("share_collection_items")
    .select("kind, item_id, sort_order")
    .eq("collection_id", collection.id)
    .order("sort_order", { ascending: true });

  if (itemsError || !itemRows?.length) {
    return { id: collection.id, title: collection.title, createdAt: collection.created_at, event, items: [] };
  }

  const byKind = new Map<MediaLibraryKind, string[]>();
  for (const row of itemRows as Array<{ kind: MediaLibraryKind; item_id: string; sort_order: number }>) {
    const list = byKind.get(row.kind) ?? [];
    list.push(row.item_id);
    byKind.set(row.kind, list);
  }

  const resolvedByKey = new Map<string, ShareCollectionResolvedItem>();
  await Promise.all(
    Array.from(byKind.entries()).map(async ([kind, ids]) => {
      const pathColumn = PATH_COLUMN[kind];
      const captionColumn = kind === "ai_image" ? "prompt" : kind === "video_edit" ? "title" : "caption";
      let query = client.from(TABLE[kind]).select(`id, ${pathColumn}, ${captionColumn}`).in("id", ids);
      if (kind === "photo" || kind === "video" || kind === "audio") {
        query = query.eq("approved", true).is("deleted_at", null);
      } else if (kind === "gallery") {
        query = query.is("deleted_at", null);
      } else {
        query = query.eq("status", "done");
      }

      const { data, error: rowError } = await query;
      if (rowError) {
        console.error(`getShareCollectionByToken: resolve failed for ${kind}:`, rowError.message);
        return;
      }

      for (const row of (data ?? []) as unknown as CaptionRow[]) {
        const path = row[pathColumn] as string | null | undefined;
        if (!path) continue;
        resolvedByKey.set(`${kind}:${row.id}`, {
          kind,
          id: row.id,
          url: publicMediaUrl(BUCKET[kind], path),
          caption: (row[captionColumn] as string | null | undefined) ?? null,
        });
      }
    }),
  );

  const items = (itemRows as Array<{ kind: MediaLibraryKind; item_id: string }>)
    .map((row) => resolvedByKey.get(`${row.kind}:${row.item_id}`))
    .filter((it): it is ShareCollectionResolvedItem => Boolean(it));

  return { id: collection.id, title: collection.title, createdAt: collection.created_at, event, items };
}
