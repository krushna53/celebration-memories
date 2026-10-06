/**
 * Builds the Shotstack edit (JSON timeline) for one guest's personalised
 * reel — a 1080×1920 (9:16) MP4 sized for Instagram Reels, WhatsApp
 * Status and TikTok. Pure and framework-free so it can be unit tested;
 * services/guest-reels.ts gathers the inputs and stores the result on
 * the guest_reels row, and the guest-reel-render Edge Function submits
 * exactly that stored edit (it never accepts slides from a caller).
 *
 * Structure (≈ 25–40 s, cut to the music's 2.6 s rhythm):
 *   1. Intro — the guest of honour's photo, slow push-in, occasion +
 *      names in gold.
 *   2. Photos of the guest WITH the guest of honour (closest matches
 *      first), then the guest on their own, topped up with photos of the
 *      guest of honour so even a guest found in one photo gets a full reel.
 *      Each photo is cropped to 9:16 around the recognised faces, so a
 *      landscape group shot frames the right people instead of the middle.
 *   3. Outro — thank-you card from the host on the event's colours.
 */

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReelPhoto {
  url: string;
  width: number;
  height: number;
  /** Faces to keep in frame (the guest and/or the guest of honour). */
  focus: FaceBox[];
  kind: "together" | "guest" | "honoree";
}

export interface ReelTheme {
  /** Accent, used for names and rules (template gold-500). */
  accent: string;
  /** Deep background for the outro card (template navy-950). */
  dark: string;
}

export interface GuestReelInput {
  guestName: string;
  honoreeName: string;
  hostedBy: string | null;
  occasionLine: string;
  dateLine: string;
  honoreePhoto: ReelPhoto | null;
  photos: ReelPhoto[];
  musicUrl: string | null;
  theme: ReelTheme;
  /** Shown small on the outro, e.g. "everymoment.app". */
  siteLabel: string;
}

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const MAX_REEL_PHOTOS = 12;
/** Fewer than this and the reel is topped up with photos of the guest of honour. */
export const MIN_REEL_PHOTOS = 6;

const PHOTO_SECONDS = 2.6;
/** With only a handful of photos, each one lingers longer so the reel still feels complete. */
const FEW_PHOTOS_SECONDS = 3.6;
const OVERLAP = 0.5;
const INTRO_SECONDS = 3.4;
const OUTRO_SECONDS = 4.6;

const FONTS = [
  "https://raw.githubusercontent.com/google/fonts/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Medium.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf",
];
const SERIF = "'DM Serif Display'";
const SANS = "'Poppins'";
const SCRIPT = "'Great Vibes'";

const EFFECTS = ["zoomInSlow", "slideRightSlow", "zoomOutSlow", "slideLeftSlow", "slideUpSlow", "zoomInSlow"];
const TRANSITIONS = ["fade", "slideLeft", "fade", "zoom", "fade", "slideUp"];

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Shotstack `crop` (fractions trimmed from each edge) that turns a photo
 * of any shape into 9:16, centred on the union of the focus faces — and
 * nudged so faces sit in the upper third rather than dead centre, which
 * reads better on a phone with captions at the bottom.
 */
export function portraitCrop(photo: Pick<ReelPhoto, "width" | "height" | "focus">) {
  const target = REEL_WIDTH / REEL_HEIGHT;
  const aspect = photo.width / photo.height;
  if (!Number.isFinite(aspect) || aspect <= 0) return undefined;

  let cx = 0.5;
  let cy = 0.42;
  if (photo.focus.length > 0) {
    const left = Math.min(...photo.focus.map((f) => f.x));
    const right = Math.max(...photo.focus.map((f) => f.x + f.w));
    const top = Math.min(...photo.focus.map((f) => f.y));
    const bottom = Math.max(...photo.focus.map((f) => f.y + f.h));
    cx = (left + right) / 2;
    cy = (top + bottom) / 2 + 0.08;
  }

  if (aspect > target) {
    // Wider than 9:16 — keep a vertical strip.
    const keep = target / aspect;
    const left = clamp(cx - keep / 2, 0, 1 - keep);
    return { left: round(left), right: round(1 - keep - left), top: 0, bottom: 0 };
  }
  // Taller than 9:16 (rare) — keep a horizontal band.
  const keep = aspect / target;
  if (keep >= 0.999) return undefined;
  const top = clamp(cy - keep / 2, 0, 1 - keep);
  return { left: 0, right: 0, top: round(top), bottom: round(1 - keep - top) };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function htmlClip(params: {
  html: string;
  css: string;
  start: number;
  length: number;
  height: number;
  position: "top" | "center" | "bottom";
  offsetY?: number;
  background?: string;
  transition?: { in?: string; out?: string };
}) {
  return {
    asset: {
      type: "html",
      html: params.html,
      css: params.css,
      width: REEL_WIDTH,
      height: params.height,
      background: params.background ?? "transparent",
      position: "center",
    },
    start: round(params.start),
    length: round(params.length),
    position: params.position,
    ...(params.offsetY ? { offset: { y: params.offsetY } } : {}),
    transition: params.transition ?? { in: "fade", out: "fade" },
  };
}

/** Order + top-up rule, exported for tests: together → guest → honoree fill, capped. */
export function pickReelPhotos(photos: ReelPhoto[]): ReelPhoto[] {
  const together = photos.filter((p) => p.kind === "together");
  const guest = photos.filter((p) => p.kind === "guest");
  const honoree = photos.filter((p) => p.kind === "honoree");
  const picked = [...together, ...guest].slice(0, MAX_REEL_PHOTOS);
  const fill = Math.max(0, MIN_REEL_PHOTOS - picked.length);
  // Interleave the honoree fill so a guest's own photos aren't all bunched at the start.
  const result = [...picked];
  honoree.slice(0, fill).forEach((p, i) => result.splice(Math.min(result.length, 1 + i * 2), 0, p));
  return result;
}

export function buildGuestReelEdit(input: GuestReelInput): { edit: Record<string, unknown>; durationSeconds: number; photoCount: number } {
  const photos = pickReelPhotos(input.photos);
  const perPhoto = photos.length <= 3 ? FEW_PHOTOS_SECONDS : PHOTO_SECONDS;
  const guest = escapeHtml(firstName(input.guestName));
  const guestFull = escapeHtml(input.guestName.trim());
  const honoree = escapeHtml(input.honoreeName.trim());
  const accent = input.theme.accent;

  const imageClips: unknown[] = [];
  const textClips: unknown[] = [];
  const shadeClips: unknown[] = [];

  // 1. Intro
  let cursor = 0;
  const introPhoto = input.honoreePhoto ?? photos[0] ?? null;
  if (introPhoto) {
    imageClips.push({
      asset: { type: "image", src: introPhoto.url, ...(portraitCrop(introPhoto) ? { crop: portraitCrop(introPhoto) } : {}) },
      start: 0,
      length: INTRO_SECONDS + OVERLAP,
      fit: "cover",
      effect: "zoomInSlow",
      transition: { in: "fade", out: "fade" },
      filter: "darken",
    });
  }
  textClips.push(
    htmlClip({
      html: `<p class="eyebrow">${escapeHtml(input.occasionLine.toUpperCase())}</p><p class="name">${honoree}</p><p class="and">&amp; ${guest}</p>`,
      css: [
        `p{margin:0;text-align:center;}`,
        `.eyebrow{font-family:${SANS};font-size:34px;letter-spacing:10px;color:#ffffff;opacity:.9;}`,
        `.name{font-family:${SERIF};font-size:118px;line-height:1.05;color:${accent};margin-top:22px;}`,
        `.and{font-family:${SCRIPT};font-size:96px;color:#ffffff;margin-top:6px;}`,
      ].join(""),
      start: 0.3,
      length: INTRO_SECONDS - 0.3,
      height: 760,
      position: "center",
      transition: { in: "fade", out: "fade" },
    }),
  );
  cursor = INTRO_SECONDS;

  // 2. Photos
  photos.forEach((photo, i) => {
    const start = cursor - OVERLAP;
    const crop = portraitCrop(photo);
    imageClips.push({
      asset: { type: "image", src: photo.url, ...(crop ? { crop } : {}) },
      start: round(start),
      length: round(perPhoto + OVERLAP),
      fit: "cover",
      effect: EFFECTS[i % EFFECTS.length],
      transition: { in: TRANSITIONS[i % TRANSITIONS.length], out: "fade" },
    });
    cursor = start + perPhoto + OVERLAP;
  });

  const photosStart = INTRO_SECONDS;
  const photosEnd = cursor;

  // Lower-third captions at a few moments, over a soft shade for legibility.
  const firstTogether = photos.findIndex((p) => p.kind === "together");
  const captionAt = (index: number) => photosStart + index * perPhoto;
  const captions: { at: number; html: string }[] = [];
  if (firstTogether >= 0) {
    captions.push({ at: captionAt(firstTogether), html: `<p class="script">${guest} &amp; ${honoree}</p>` });
  } else if (photos.length > 0) {
    captions.push({ at: captionAt(0), html: `<p class="script">${guest}</p>` });
  }
  if (photos.length >= 5) {
    captions.push({
      at: captionAt(Math.floor(photos.length / 2)),
      html: `<p class="small">${escapeHtml(input.dateLine)}</p>`,
    });
  }
  for (const caption of captions) {
    shadeClips.push(
      htmlClip({
        html: `<div></div>`,
        css: `div{width:100%;height:100%;}`,
        start: caption.at,
        length: perPhoto,
        height: 520,
        position: "bottom",
        background: "rgba(0,0,0,0.38)",
      }),
    );
    textClips.push(
      htmlClip({
        html: caption.html,
        css: [
          `p{margin:0;text-align:center;}`,
          `.script{font-family:${SCRIPT};font-size:104px;color:#ffffff;}`,
          `.small{font-family:${SANS};font-size:40px;letter-spacing:8px;color:#ffffff;}`,
        ].join(""),
        start: caption.at + 0.2,
        length: perPhoto - 0.2,
        height: 260,
        position: "bottom",
        offsetY: 0.06,
      }),
    );
  }

  // 3. Outro card
  const outroStart = photosEnd - OVERLAP;
  const host = input.hostedBy ? escapeHtml(input.hostedBy.trim()) : null;
  textClips.push(
    htmlClip({
      html: [
        `<p class="eyebrow">THANK YOU</p>`,
        `<p class="guest">${guestFull}</p>`,
        `<p class="msg">for celebrating ${honoree} with us</p>`,
        `<div class="rule"></div>`,
        host ? `<p class="host">With love, ${host}</p>` : "",
        `<p class="date">${escapeHtml(input.dateLine)}</p>`,
        `<p class="site">${escapeHtml(input.siteLabel)}</p>`,
      ].join(""),
      css: [
        `p{margin:0;text-align:center;}`,
        `.eyebrow{font-family:${SANS};font-size:34px;letter-spacing:12px;color:${accent};}`,
        `.guest{font-family:${SERIF};font-size:104px;line-height:1.1;color:#ffffff;margin:34px 60px 0;}`,
        `.msg{font-family:${SANS};font-size:42px;color:#ffffff;opacity:.85;margin:24px 80px 0;}`,
        `.rule{width:160px;height:3px;background:${accent};margin:56px auto;}`,
        `.host{font-family:${SCRIPT};font-size:84px;color:${accent};}`,
        `.date{font-family:${SANS};font-size:32px;letter-spacing:6px;color:#ffffff;opacity:.7;margin-top:30px;}`,
        `.site{font-family:${SANS};font-size:26px;letter-spacing:4px;color:#ffffff;opacity:.45;margin-top:150px;}`,
      ].join(""),
      start: outroStart,
      length: OUTRO_SECONDS,
      height: REEL_HEIGHT,
      position: "center",
      background: input.theme.dark,
      transition: { in: "fade" },
    }),
  );
  const duration = round(outroStart + OUTRO_SECONDS);

  // A thin accent frame across the photo section — the "printed keepsake" look.
  const frame = htmlClip({
    html: `<div></div>`,
    css: `div{position:absolute;left:36px;top:36px;right:36px;bottom:36px;border:3px solid ${accent};opacity:.75;}`,
    start: INTRO_SECONDS - OVERLAP,
    length: Math.max(1, outroStart - (INTRO_SECONDS - OVERLAP)),
    height: REEL_HEIGHT,
    position: "center",
  });

  const timeline: Record<string, unknown> = {
    background: input.theme.dark,
    fonts: FONTS.map((src) => ({ src })),
    // First track renders on top.
    tracks: [{ clips: textClips }, { clips: [frame] }, { clips: shadeClips }, { clips: imageClips }].filter(
      (t) => t.clips.length > 0,
    ),
  };
  if (input.musicUrl) timeline.soundtrack = { src: input.musicUrl, effect: "fadeInFadeOut", volume: 0.9 };

  return {
    edit: {
      timeline,
      output: { format: "mp4", size: { width: REEL_WIDTH, height: REEL_HEIGHT }, fps: 30 },
    },
    durationSeconds: duration,
    photoCount: photos.length,
  };
}
