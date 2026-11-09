import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { REEL_MUSIC } from "@/lib/reel-music";
import { publicMediaUrl } from "@/services/uploads";
import { readDisplayPlaylist, validateDisplayPlaylist, type DisplayTrack } from "@/lib/display-music";

/** A null playlist preserves the event's existing single-song setting. */
export async function getDisplayMusic(eventId: string): Promise<DisplayTrack[]> {
  const { data, error } = await supabaseAdmin().from("events")
    .select("display_music, display_music_path, display_music_playlist").eq("id", eventId).maybeSingle();
  if (error) throw new Error(`Couldn't load music: ${error.message}`);
  return data ? readDisplayPlaylist(data) : [];
}

export async function getDisplayMusicUrls(eventId: string): Promise<string[]> {
  try {
    return (await getDisplayMusic(eventId)).map(track => track.choice === "custom"
      ? publicMediaUrl("audio", track.path) : REEL_MUSIC[track.choice].url);
  } catch (err) {
    console.error("getDisplayMusicUrls failed:", err);
    return [];
  }
}

export async function setDisplayMusic(eventId: string, value: unknown): Promise<void> {
  const tracks = validateDisplayPlaylist(eventId, value);
  // Keep the first song usable by older deployments during the rollout.
  const first = tracks[0];
  const { error } = await supabaseAdmin().from("events").update({
    display_music_playlist: tracks,
    display_music: first?.choice ?? null,
    display_music_path: first?.path ?? null,
  }).eq("id", eventId);
  if (error) throw new Error(`Failed to save music: ${error.message}`);
}
