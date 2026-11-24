// Pure Shotstack edit builder for the Life Story film — no I/O, so it's
// unit-tested directly (tests/life-story.cjs). index.ts signs the URLs and
// passes plain data in.
//
// Layout (16:9, 1280×720): an intro title card over the cover photo, one
// scene per script line, an outro card. Every scene is timed to its own
// voiceover. A photo sits "contained" (never cropping a face) over a blurred,
// cover-fit copy of itself; a Grok Imagine clip replaces the sharp photo for
// as long as the clip lasts, and the photo carries on with a slow zoom if
// the narration runs longer than the clip.

export type Motion = "zoom_in" | "zoom_out" | "pan_left" | "pan_right";

export interface FilmSceneInput {
  photoUrl: string | null;
  /** Grok Imagine clip for this scene, when one was made. */
  clipUrl: string | null;
  clipSeconds: number | null;
  narrationUrl: string | null;
  narrationSeconds: number;
  caption: string;
  motion: Motion;
}

export interface FilmInput {
  title: string;
  subtitle: string;
  lifeSpan: string;
  coverUrl: string | null;
  scenes: FilmSceneInput[];
  musicUrl: string | null;
}

export const WIDTH = 1280;
export const HEIGHT = 720;
export const INTRO_SECONDS = 5;
export const OUTRO_SECONDS = 5;
export const MIN_SCENE_SECONDS = 4;
/** Breathing room around each line: lead-in before the voice starts, and a pause after it ends. */
export const NARRATION_LEAD_IN = 0.5;
export const NARRATION_TAIL = 0.9;

const EFFECT: Record<Motion, string> = {
  zoom_in: "zoomInSlow",
  zoom_out: "zoomOutSlow",
  pan_left: "slideLeftSlow",
  pan_right: "slideRightSlow",
};

export const round = (n: number) => Math.round(n * 100) / 100;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** How long a scene stays on screen for a voiceover of `narrationSeconds`. */
export function sceneSeconds(narrationSeconds: number): number {
  return round(Math.max(MIN_SCENE_SECONDS, NARRATION_LEAD_IN + narrationSeconds + NARRATION_TAIL));
}

/** Grok Imagine clip length to request for a scene: whole seconds, 3–15 (the API's limit). */
export function clipRequestSeconds(narrationSeconds: number): number {
  return Math.min(15, Math.max(3, Math.ceil(sceneSeconds(narrationSeconds))));
}

function htmlCard(html: string, css: string, start: number, length: number, height = HEIGHT, position = "center") {
  return {
    asset: { type: "html", html, css, width: WIDTH, height, background: "transparent", position: "center" },
    start: round(start),
    length: round(length),
    position,
    transition: { in: "fade", out: "fade" },
  };
}

const TITLE_CSS =
  "div { font-family: 'Playfair Display', Georgia, serif; color: #fdf6ec; text-align: center; } " +
  "h1 { font-size: 64px; font-weight: 600; margin: 0; } " +
  "p { font-family: 'Open Sans', Arial, sans-serif; font-size: 26px; margin: 18px 0 0; color: #f3e2c7; letter-spacing: 2px; } " +
  "span { display: block; font-family: 'Open Sans', Arial, sans-serif; font-size: 22px; margin-top: 14px; color: #ffc7bc; letter-spacing: 6px; }";

const CAPTION_CSS =
  "p { font-family: 'Open Sans', Arial, sans-serif; font-size: 28px; color: #ffffff; text-align: center; " +
  "background-color: rgba(10, 8, 30, 0.55); padding: 10px 26px; margin: 0; }";

export function buildFilmEdit(input: FilmInput): { edit: Record<string, unknown>; durationSeconds: number } {
  const captions: unknown[] = [];
  const cards: unknown[] = [];
  const foreground: unknown[] = [];
  const background: unknown[] = [];
  const voice: unknown[] = [];

  const backdrop = (src: string, start: number, length: number, filter = "blur") => ({
    asset: { type: "image", src },
    start: round(start),
    length: round(length),
    fit: "cover",
    filter,
    opacity: 0.55,
    transition: { in: "fade", out: "fade" },
  });

  // 1. Intro card
  const cover = input.coverUrl ?? input.scenes.find((s) => s.photoUrl)?.photoUrl ?? null;
  const intro =
    `<div><h1>${escapeHtml(input.title)}</h1>` +
    (input.subtitle ? `<p>${escapeHtml(input.subtitle)}</p>` : "") +
    (input.lifeSpan ? `<span>${escapeHtml(input.lifeSpan)}</span>` : "") +
    `</div>`;
  cards.push(htmlCard(intro, TITLE_CSS, 0, INTRO_SECONDS));
  if (cover) background.push(backdrop(cover, 0, INTRO_SECONDS, "darken"));

  // 2. Scenes, back to back, each timed to its voiceover
  let cursor = INTRO_SECONDS;
  for (const scene of input.scenes) {
    const length = sceneSeconds(scene.narrationSeconds);
    if (scene.photoUrl) background.push(backdrop(scene.photoUrl, cursor, length));

    const clipLength = scene.clipUrl ? Math.min(length, scene.clipSeconds ?? length) : 0;
    if (scene.clipUrl && clipLength > 0) {
      foreground.push({
        asset: { type: "video", src: scene.clipUrl, volume: 0 },
        start: round(cursor),
        length: round(clipLength),
        fit: "contain",
        transition: { in: "fade", ...(clipLength >= length ? { out: "fade" } : {}) },
      });
    }
    const photoStart = cursor + clipLength;
    const photoLength = length - clipLength;
    if (scene.photoUrl && photoLength > 0.2) {
      foreground.push({
        asset: { type: "image", src: scene.photoUrl },
        start: round(photoStart),
        length: round(photoLength),
        fit: "contain",
        effect: EFFECT[scene.motion] ?? EFFECT.zoom_in,
        transition: { ...(clipLength > 0 ? {} : { in: "fade" }), out: "fade" },
      });
    }

    if (scene.narrationUrl) {
      voice.push({
        asset: { type: "audio", src: scene.narrationUrl, volume: 1 },
        start: round(cursor + NARRATION_LEAD_IN),
        length: round(Math.max(0.5, scene.narrationSeconds)),
      });
    }
    if (scene.caption.trim()) {
      captions.push(htmlCard(`<p>${escapeHtml(scene.caption.trim())}</p>`, CAPTION_CSS, cursor + 0.4, length - 0.6, 120, "bottom"));
    }
    cursor += length;
  }

  // 3. Outro card
  const outro = `<div><h1>${escapeHtml(input.title)}</h1>${input.lifeSpan ? `<span>${escapeHtml(input.lifeSpan)}</span>` : ""}</div>`;
  cards.push(htmlCard(outro, TITLE_CSS, cursor, OUTRO_SECONDS));
  if (cover) background.push(backdrop(cover, cursor, OUTRO_SECONDS, "darken"));
  cursor += OUTRO_SECONDS;

  const tracks = [captions, cards, foreground, background, voice].filter((clips) => clips.length > 0).map((clips) => ({ clips }));

  return {
    edit: {
      timeline: {
        background: "#0c0a1f",
        ...(input.musicUrl ? { soundtrack: { src: input.musicUrl, effect: "fadeInFadeOut", volume: 0.16 } } : {}),
        tracks,
      },
      output: { format: "mp4", resolution: "hd", fps: 25 },
    },
    durationSeconds: round(cursor),
  };
}

/** Raw 24 kHz 16-bit mono PCM (OpenAI TTS "pcm") → playable WAV. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

export function pcmSeconds(byteLength: number, sampleRate = 24000): number {
  return byteLength / (sampleRate * 2);
}
