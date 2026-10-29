import { z } from "zod";
import { REEL_MUSIC } from "@/lib/reel-music";

export const displayTrackSchema = z.discriminatedUnion("choice", [
  z.object({ choice: z.enum(["celebration", "heartfelt", "modern", "cinematic"]), path: z.null() }),
  z.object({ choice: z.literal("custom"), path: z.string().min(1).max(1024) }),
]);
export const displayPlaylistSchema = z.array(displayTrackSchema).max(20, "Choose up to 20 songs.");
export type DisplayTrack = z.infer<typeof displayTrackSchema>;
export function trackKey(track: DisplayTrack): string { return track.path ?? track.choice; }
export function trackLabel(track: DisplayTrack): string {
  return track.choice === "custom"
    ? track.path.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "")
    : REEL_MUSIC[track.choice].label;
}
export function validateDisplayPlaylist(eventId: string, value: unknown): DisplayTrack[] {
  const tracks = displayPlaylistSchema.parse(value);
  for (const track of tracks) {
    if (track.choice === "custom" && (!track.path.startsWith(`${eventId}/slideshow-music/`) || track.path.includes(".."))) {
      throw new Error("Choose songs uploaded to this event.");
    }
  }
  if (new Set(tracks.map(trackKey)).size !== tracks.length) throw new Error("Each song can appear only once.");
  return tracks;
}
export function readDisplayPlaylist(row: { display_music_playlist?: unknown; display_music?: string | null; display_music_path?: string | null }): DisplayTrack[] {
  if (row.display_music_playlist != null) return displayPlaylistSchema.parse(row.display_music_playlist);
  if (!row.display_music || row.display_music === "none") return [];
  const legacy = displayTrackSchema.safeParse({ choice: row.display_music, path: row.display_music === "custom" ? row.display_music_path : null });
  return legacy.success ? [legacy.data] : [];
}
