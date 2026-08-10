import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type FeatureVideoSourceType = "link" | "upload";

export interface PlatformVideoSettings {
  enabled: boolean;
  sourceType: FeatureVideoSourceType;
  videoUrl: string | null;
  storagePath: string | null;
  title: string | null;
}

interface PlatformVideoSettingsRow {
  enabled: boolean;
  source_type: string;
  video_url: string | null;
  storage_path: string | null;
  title: string | null;
}

const DEFAULT_SETTINGS: PlatformVideoSettings = {
  enabled: false,
  sourceType: "link",
  videoUrl: null,
  storagePath: null,
  title: null,
};

function rowToSettings(row: PlatformVideoSettingsRow): PlatformVideoSettings {
  return {
    enabled: row.enabled,
    sourceType: row.source_type === "upload" ? "upload" : "link",
    videoUrl: row.video_url,
    storagePath: row.storage_path,
    title: row.title,
  };
}

/**
 * The platform's single "See It In Action" feature video — see
 * features/admin/platform-video for the admin editor and
 * features/platform/feature-video-section.tsx for the public display.
 * Falls back to DEFAULT_SETTINGS (disabled) if the row is somehow
 * missing, so the homepage never crashes on this.
 */
export async function getPlatformVideoSettings(): Promise<PlatformVideoSettings> {
  const { data, error } = await supabaseAdmin()
    .from("platform_video_settings")
    .select("enabled, source_type, video_url, storage_path, title")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getPlatformVideoSettings failed, using defaults:", error.message);
    return DEFAULT_SETTINGS;
  }

  return rowToSettings(data as PlatformVideoSettingsRow);
}

export interface PlatformVideoSettingsInput {
  enabled: boolean;
  sourceType: FeatureVideoSourceType;
  videoUrl: string | null;
  storagePath: string | null;
  title: string | null;
}

/**
 * Also best-effort deletes the previously-uploaded Storage file if this
 * save replaces it with a different upload (or moves away from "upload"
 * entirely) — otherwise the old file is orphaned in Storage forever,
 * since nothing else references it once the row's storage_path moves on.
 */
export async function updatePlatformVideoSettings(input: PlatformVideoSettingsInput): Promise<void> {
  const client = supabaseAdmin();

  const { data: current } = await client
    .from("platform_video_settings")
    .select("source_type, storage_path")
    .eq("id", "default")
    .maybeSingle();

  const oldPath = (current as { source_type: string; storage_path: string | null } | null)?.storage_path;
  if (current?.source_type === "upload" && oldPath && oldPath !== input.storagePath) {
    await client.storage.from("videos").remove([oldPath]);
  }

  const { error } = await client
    .from("platform_video_settings")
    .update({
      enabled: input.enabled,
      source_type: input.sourceType,
      video_url: input.videoUrl,
      storage_path: input.storagePath,
      title: input.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) throw new Error(`Failed to update platform video settings: ${error.message}`);
}
