import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import type { MemoryItem } from "@/types/memory";

interface BaseRow {
  id: string;
  caption: string | null;
  storage_path: string;
  approved: boolean;
  featured: boolean;
  created_at: string;
  invitees: { name: string; relationship: string | null } | null;
}

async function fetchApproved(table: string, eventId: string, limit: number) {
  const { data, error } = await supabaseAdmin()
    .from(table)
    .select("*, invitees(name, relationship)")
    .eq("event_id", eventId)
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`Memory wall query failed (${table}):`, error.message);
    return [];
  }
  return (data ?? []) as unknown as BaseRow[];
}

/**
 * Combines approved photos, videos, audio, and guestbook entries into a
 * single newest-first feed for the public Memory Wall. Each table is
 * queried independently (simplest correct approach for a handful of
 * small per-event tables) then merged and re-sorted in application code.
 */
export async function getMemoryWallItems(
  eventId: string,
  limit = 24,
): Promise<MemoryItem[]> {
  const [photos, videos, audio, guestbookRows] = await Promise.all([
    fetchApproved("photos", eventId, limit),
    fetchApproved("videos", eventId, limit),
    fetchApproved("audio", eventId, limit),
    supabaseAdmin()
      .from("guestbook")
      .select("*, invitees(name, relationship)")
      .eq("event_id", eventId)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then((res) => res.data ?? []),
  ]);

  const items: MemoryItem[] = [
    ...photos.map((row): MemoryItem => ({
      id: row.id,
      kind: "photo",
      url: publicMediaUrl("photos", row.storage_path),
      thumbnailUrl: null,
      caption: row.caption,
      message: null,
      country: null,
      featured: row.featured,
      createdAt: row.created_at,
      author: {
        name: row.invitees?.name ?? "A guest",
        relationship: row.invitees?.relationship ?? null,
      },
    })),
    ...videos.map((row): MemoryItem => ({
      id: row.id,
      kind: "video",
      url: publicMediaUrl("videos", row.storage_path),
      thumbnailUrl: null,
      caption: row.caption,
      message: null,
      country: null,
      featured: row.featured,
      createdAt: row.created_at,
      author: {
        name: row.invitees?.name ?? "A guest",
        relationship: row.invitees?.relationship ?? null,
      },
    })),
    ...audio.map((row): MemoryItem => ({
      id: row.id,
      kind: "audio",
      url: publicMediaUrl("audio", row.storage_path),
      thumbnailUrl: null,
      caption: row.caption,
      message: null,
      country: null,
      featured: row.featured,
      createdAt: row.created_at,
      author: {
        name: row.invitees?.name ?? "A guest",
        relationship: row.invitees?.relationship ?? null,
      },
    })),
    ...(guestbookRows as unknown as Array<{
      id: string;
      guest_name: string;
      message: string;
      country: string | null;
      photo_storage_path: string | null;
      featured: boolean;
      created_at: string;
      invitees: { name: string; relationship: string | null } | null;
    }>).map((row): MemoryItem => ({
      id: row.id,
      kind: "guestbook",
      url: "",
      thumbnailUrl: row.photo_storage_path
        ? publicMediaUrl("photos", row.photo_storage_path)
        : null,
      caption: null,
      message: row.message,
      country: row.country,
      featured: row.featured,
      createdAt: row.created_at,
      author: { name: row.guest_name, relationship: null },
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}
