import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { REEL_MUSIC } from "@/lib/reel-music";
import { publicMediaUrl } from "@/services/uploads";

/**
 * Background music for the Big Screen Display — chosen on the admin
 * dashboard, played by features/display/display-music.tsx. Reuses the
 * Guest Reels track list (lib/reel-music.ts) plus the host's own upload.
 * Off unless the host picks something.
 */

export type DisplayMusicChoice = Exclude<keyof typeof REEL_MUSIC, "none"> | "custom" | "none";

export interface DisplayMusicSetting {
  choice: DisplayMusicChoice;
  /** Only for "custom". */
  path: string | null;
}

function isPreset(key: string): key is Exclude<keyof typeof REEL_MUSIC, "none"> {
  return key !== "none" && key in REEL_MUSIC;
}

export async function getDisplayMusic(eventId: string): Promise<DisplayMusicSetting> {
  const { data } = await supabaseAdmin()
    .from("events")
    .select("display_music, display_music_path")
    .eq("id", eventId)
    .maybeSingle<{ display_music: string | null; display_music_path: string | null }>();
  const key = data?.display_music ?? "none";
  if (key === "custom" && data?.display_music_path) return { choice: "custom", path: data.display_music_path };
  return { choice: isPreset(key) ? key : "none", path: null };
}

/** The URL the display plays, or null for silence. Never throws — music is optional. */
export async function getDisplayMusicUrl(eventId: string): Promise<string | null> {
  try {
    const setting = await getDisplayMusic(eventId);
    if (setting.choice === "custom") return setting.path ? publicMediaUrl("audio", setting.path) : null;
    if (setting.choice === "none") return null;
    return REEL_MUSIC[setting.choice].url;
  } catch (err) {
    console.error("getDisplayMusicUrl failed:", err);
    return null;
  }
}

export async function setDisplayMusic(eventId: string, choice: string, path: string | null): Promise<void> {
  let row: { display_music: string | null; display_music_path: string | null };
  if (choice === "custom") {
    if (!path || !path.startsWith(`${eventId}/slideshow-music/`) || path.includes("..")) throw new Error("Upload a song first.");
    row = { display_music: "custom", display_music_path: path };
  } else if (choice === "none") {
    row = { display_music: null, display_music_path: null };
  } else if (isPreset(choice)) {
    row = { display_music: choice, display_music_path: null };
  } else {
    throw new Error("Unknown track.");
  }
  const { error } = await supabaseAdmin().from("events").update(row).eq("id", eventId);
  if (error) throw new Error(`Failed to save music: ${error.message}`);
}
