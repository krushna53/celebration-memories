import "server-only";

/**
 * Thin server-only wrapper around the two fast, synchronous HeyGen v2
 * endpoints (list avatars / list voices) used to populate the AI
 * Timeline Movie composer's pickers — see features/admin/timeline-movie/.
 *
 * The actual video generation (submit + poll) does NOT go through this
 * file — that's long-running/async and runs in the two Supabase Edge
 * Functions (supabase/functions/generate-timeline-movie and
 * timeline-movie-status), which call the HeyGen REST API directly with
 * their own fetch calls, same as generate-slideshow-video does for
 * Shotstack. This file is only for the quick metadata lookups a Next.js
 * Server Component/Action can safely do inline.
 *
 * Get an API key: https://developers.heygen.com/docs/api-key — set
 * HEYGEN_API_KEY as an env var (Next.js) AND as a Supabase Edge Function
 * secret (`supabase secrets set HEYGEN_API_KEY=...`), since the two run
 * in separate environments. See the README's "AI Timeline Movie"
 * section for the full setup.
 */

const HEYGEN_API_BASE = "https://api.heygen.com";

export function isHeygenConfigured(): boolean {
  return Boolean(process.env.HEYGEN_API_KEY);
}

export interface HeygenAvatar {
  avatarId: string;
  name: string;
  gender: string | null;
  previewImageUrl: string | null;
}

export interface HeygenVoice {
  voiceId: string;
  name: string;
  language: string | null;
  gender: string | null;
}

/** A small, known-good fallback list so the composer still has *something* pickable if the live list call fails (rate limit, transient outage, etc.) — these are long-standing public HeyGen sample avatars/voices, not guaranteed permanent, just a reasonable default. */
const FALLBACK_AVATARS: HeygenAvatar[] = [
  { avatarId: "Daisy-inskirt-20220818", name: "Daisy", gender: "female", previewImageUrl: null },
  { avatarId: "Wayne_20240711", name: "Wayne", gender: "male", previewImageUrl: null },
];
const FALLBACK_VOICES: HeygenVoice[] = [
  { voiceId: "1bd001e7e50f421d891986aad5158bc8", name: "Default", language: "English", gender: null },
];

export async function listHeygenAvatars(): Promise<HeygenAvatar[]> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v2/avatars`, {
      headers: { "X-Api-Key": apiKey },
      // Avatars/voices change rarely — cache for a few minutes so the
      // composer doesn't refetch HeyGen's full catalog on every page load.
      next: { revalidate: 300 },
    });
    const payload = await res.json();
    const avatars = payload?.data?.avatars;
    if (!res.ok || !Array.isArray(avatars)) throw new Error(payload?.message || `HeyGen returned ${res.status}`);

    const mapped: HeygenAvatar[] = avatars
      .slice(0, 60)
      .map((a: Record<string, unknown>) => ({
        avatarId: String(a.avatar_id ?? ""),
        name: String(a.avatar_name ?? a.avatar_id ?? "Avatar"),
        gender: typeof a.gender === "string" ? a.gender : null,
        previewImageUrl: typeof a.preview_image_url === "string" ? a.preview_image_url : null,
      }))
      .filter((a) => a.avatarId);

    return mapped.length > 0 ? mapped : FALLBACK_AVATARS;
  } catch (err) {
    console.error("listHeygenAvatars failed, using fallback list:", err);
    return FALLBACK_AVATARS;
  }
}

export async function listHeygenVoices(): Promise<HeygenVoice[]> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v2/voices`, {
      headers: { "X-Api-Key": apiKey },
      next: { revalidate: 300 },
    });
    const payload = await res.json();
    const voices = payload?.data?.voices;
    if (!res.ok || !Array.isArray(voices)) throw new Error(payload?.message || `HeyGen returned ${res.status}`);

    const mapped: HeygenVoice[] = voices
      .slice(0, 100)
      .map((v: Record<string, unknown>) => ({
        voiceId: String(v.voice_id ?? ""),
        name: String(v.name ?? v.voice_id ?? "Voice"),
        language: typeof v.language === "string" ? v.language : null,
        gender: typeof v.gender === "string" ? v.gender : null,
      }))
      .filter((v) => v.voiceId);

    return mapped.length > 0 ? mapped : FALLBACK_VOICES;
  } catch (err) {
    console.error("listHeygenVoices failed, using fallback list:", err);
    return FALLBACK_VOICES;
  }
}
