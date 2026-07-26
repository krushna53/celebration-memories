import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

export type ModerationKind = "photo" | "video" | "audio" | "guestbook";

const TABLE: Record<ModerationKind, string> = {
  photo: "photos",
  video: "videos",
  audio: "audio",
  guestbook: "guestbook",
};

const BUCKET: Partial<Record<ModerationKind, string>> = {
  photo: "photos",
  video: "videos",
  audio: "audio",
};

export interface ModerationItem {
  id: string;
  kind: ModerationKind;
  url: string | null;
  caption: string | null;
  message: string | null;
  guestName: string;
  approved: boolean;
  featured: boolean;
  createdAt: string;
}

export async function listMemoriesForModeration(
  eventId: string,
  filter: "pending" | "all" = "pending",
): Promise<ModerationItem[]> {
  const kinds: ModerationKind[] = ["photo", "video", "audio", "guestbook"];

  const results = await Promise.all(
    kinds.map(async (kind) => {
      let query = supabaseAdmin()
        .from(TABLE[kind])
        .select("*, invitees(name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (filter === "pending") query = query.eq("approved", false);

      const { data, error } = await query;
      if (error) {
        console.error(`listMemoriesForModeration(${kind}) failed:`, error.message);
        return [];
      }

      return (
        data as Array<{
          id: string;
          caption?: string | null;
          message?: string | null;
          storage_path?: string | null;
          approved: boolean;
          featured: boolean;
          created_at: string;
          invitees: { name: string } | null;
        }>
      ).map((row): ModerationItem => ({
        id: row.id,
        kind,
        url:
          kind !== "guestbook" && row.storage_path && BUCKET[kind]
            ? publicMediaUrl(BUCKET[kind]!, row.storage_path)
            : null,
        caption: row.caption ?? null,
        message: row.message ?? null,
        guestName: row.invitees?.name ?? "A guest",
        approved: row.approved,
        featured: row.featured,
        createdAt: row.created_at,
      }));
    }),
  );

  return results
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function setMemoryApproval(
  kind: ModerationKind,
  id: string,
  approved: boolean,
): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE[kind]).update({ approved }).eq("id", id);
  if (error) throw new Error(`Failed to update approval: ${error.message}`);
}

export async function setMemoryFeatured(
  kind: ModerationKind,
  id: string,
  featured: boolean,
): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE[kind]).update({ featured }).eq("id", id);
  if (error) throw new Error(`Failed to update featured flag: ${error.message}`);
}

export async function deleteMemory(kind: ModerationKind, id: string): Promise<void> {
  const client = supabaseAdmin();
  const bucket = BUCKET[kind];

  if (bucket) {
    const { data } = await client.from(TABLE[kind]).select("storage_path").eq("id", id).maybeSingle();
    if (data?.storage_path) {
      await client.storage.from(bucket).remove([data.storage_path]);
    }
  }

  const { error } = await client.from(TABLE[kind]).delete().eq("id", id);
  if (error) throw new Error(`Failed to delete: ${error.message}`);
}
