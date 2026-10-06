/**
 * Royalty-free background tracks for Guest Reels, hosted by Shotstack
 * for use in renders (their FreePD / Unminus sample library). Chosen per
 * event on /admin/reels (events.reel_music). "none" renders silent —
 * useful when guests will add a trending sound in Instagram themselves.
 */
export const REEL_MUSIC = {
  celebration: {
    label: "Celebration — upbeat & bright",
    url: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/freepd/fireworks.mp3",
  },
  heartfelt: {
    label: "Heartfelt — warm & gentle",
    url: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/ambisax.mp3",
  },
  modern: {
    label: "Modern — light pop groove",
    url: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/palmtrees.mp3",
  },
  cinematic: {
    label: "Cinematic — sweeping & emotional",
    url: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/freepd/motions.mp3",
  },
  none: { label: "No music", url: null },
} as const satisfies Record<string, { label: string; url: string | null }>;

export type ReelMusicKey = keyof typeof REEL_MUSIC;

export function resolveReelMusic(key: string | null | undefined): ReelMusicKey {
  return key && key in REEL_MUSIC ? (key as ReelMusicKey) : "celebration";
}
