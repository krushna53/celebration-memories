// Makes the couple's envelope film in the browser: every frame of our own film, with only the seal's letters
// changed to Grok's (lib/seal-letters.js), encoded as an MP4 with mediabunny. Nothing else in the film changes.
import { sealAt, letterMasks, swapLetters } from "./seal-letters";

const picture = (src) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error("Grok's seal picture could not be read."));
  img.src = src;
});

/**
 * src: our film's URL. grokSeal: Grok's re-lettered seal close-up (data URL, cut as sealCloseUp does).
 * track: where the seal is in the film (lib/envelope-seal-track.js). onProgress(0–1). Returns the MP4's bytes.
 */
export async function bakeSealFilm(src, grokSeal, track, onProgress) {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.UrlSource(src), formats: mb.ALL_FORMATS });
  const film = await input.getPrimaryVideoTrack();
  if (!film) throw new Error("The envelope film could not be read.");
  const W = film.displayWidth, H = film.displayHeight, total = await input.computeDuration();
  const codec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: W, height: H });
  if (!codec) throw new Error("This browser cannot make the envelope film. Try Chrome or Edge on a computer.");
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const video = new mb.CanvasSource(canvas, { codec, bitrate: 4_000_000, keyFrameInterval: 1 });
  output.addVideoTrack(video, { frameRate: 30 });
  await output.start();
  const grok = await picture(grokSeal);
  let masks = null;
  for await (const frame of new mb.CanvasSink(film).canvases()) {
    ctx.drawImage(frame.canvas, 0, 0, W, H);
    const seal = sealAt(track, frame.timestamp);
    if (seal) { masks ??= letterMasks(ctx, seal, grok); swapLetters(ctx, seal, masks); }
    await video.add(frame.timestamp, frame.duration);
    onProgress?.(Math.min(1, (frame.timestamp + frame.duration) / total));
  }
  await output.finalize();
  return new Uint8Array(output.target.buffer);
}
