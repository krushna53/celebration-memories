// Changes only the letters on the wax seal in one frame of our envelope film; every other pixel stays as it is.
// Grok re-letters a close-up of the seal once (its image edit is good at text). For each frame, the old
// letters' strokes are filled with that frame's own wax (taken from around them), and Grok's new strokes are
// drawn in that frame's own gold (taken from the old strokes), so the letters glow along with the film.
// Plain canvas code, no imports: used in the browser by lib/seal-film.js.

export const SEAL_CROP = 1.35; // a close-up is a square SEAL_CROP seal-radii from the centre to each side (as in SgEnvelope)
const N = 288; // working square, about the close-up's size in our 720 px wide film

const smooth = (v, lo, hi) => { const k = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return k * k * (3 - 2 * k); };

/** seal position at time t, blended between the two nearest samples of the track */
export function sealAt(track, t) {
  let i = 0;
  while (i < track.length - 2 && track[i + 1][0] <= t) i++;
  const a = track[i], b = track[i + 1] ?? a;
  if (a[1] == null || b[1] == null) return a[1] == null ? null : a;
  const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
  return a.map((v, j) => v + (b[j] - v) * k);
}

/** box blur of an N×N channel, run twice (close to a gaussian) */
function blur(src, r) {
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  const pass = (from, to, horizontal) => {
    for (let line = 0; line < N; line++) {
      let sum = 0;
      const at = (k) => (horizontal ? line * N + k : k * N + line);
      for (let k = -r; k <= r; k++) sum += from[at(Math.min(N - 1, Math.max(0, k)))];
      for (let k = 0; k < N; k++) {
        to[at(k)] = sum / (2 * r + 1);
        sum += from[at(Math.min(N - 1, k + r + 1))] - from[at(Math.max(0, k - r))];
      }
    }
  };
  pass(src, tmp, true); pass(tmp, out, false);
  pass(out, tmp, true); pass(tmp, out, false);
  return out;
}

/** the frame's seal area as an N×N square (the seal ellipse becomes a circle) */
function region(W, H, seal) {
  const [, fx, fy, frx, fry] = seal;
  const rx = frx * W, ry = fry * W; // both radii are parts of the width (see envelope-seal-track.js)
  return { x: fx * W - SEAL_CROP * rx, y: fy * H - SEAL_CROP * ry, w: 2 * SEAL_CROP * rx, h: 2 * SEAL_CROP * ry };
}
const work = () => { const c = document.createElement("canvas"); c.width = c.height = N; return c; };

/**
 * Where the old letters are (from our first frame) and where Grok's new letters are (from its close-up), 0–1.
 * ctx: a canvas with our film's first frame; grok: Grok's re-lettered close-up (image or canvas).
 */
export function letterMasks(ctx, seal, grok) {
  const W = ctx.canvas.width, H = ctx.canvas.height, r = region(W, H, seal);
  const c = work(), x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, N, N);
  const ours = x.getImageData(0, 0, N, N).data;
  x.clearRect(0, 0, N, N); x.drawImage(grok, 0, 0, N, N);
  const theirs = x.getImageData(0, 0, N, N).data;
  const seal1 = N / 2 / SEAL_CROP;
  const oldM = new Float32Array(N * N), newM = new Float32Array(N * N), lum = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const d = Math.hypot((i % N) - N / 2 + 0.5, ((i / N) | 0) - N / 2 + 0.5) / seal1;
    const inside = 1 - smooth(d, 0.62, 0.7); // the pressed inner face, inside the wax rim
    // gold has a lot of green; the red wax has almost none
    oldM[i] = inside * smooth(ours[i * 4 + 1], 45, 100);
    newM[i] = inside * smooth(theirs[i * 4 + 1], 45, 100);
    lum[i] = 0.3 * theirs[i * 4] + 0.59 * theirs[i * 4 + 1] + 0.11 * theirs[i * 4 + 2];
  }
  // widen the old strokes a little, so their soft edges and pressed shadows go too
  const wide = blur(oldM, 2).map((v, i) => Math.max(oldM[i], smooth(v, 0.04, 0.3)));
  // the new strokes keep Grok's engraved shading, relative to their average brightness
  let sum = 0, n = 0;
  for (let i = 0; i < N * N; i++) if (newM[i] > 0.8) { sum += lum[i]; n++; }
  const mean = n ? sum / n : 1;
  const shade = lum.map((v) => Math.min(1.3, Math.max(0.7, v / mean)));
  const core = oldM.map((v) => (v > 0.85 ? 1 : 0));
  const pts = [];
  for (let i = 0; i < N * N; i += 2) if (core[i]) pts.push(i % N, (i / N) | 0);
  return { oldM: wide, core, newM, shade, pts: Int16Array.from(pts), at: { dx: 0, dy: 0, s: 1 } };
}

/** where this frame's old letters really are: the shift and size, near the last frame's, that best covers its gold */
function align(p, masks) {
  const gl = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) gl[i] = p[i * 4 + 1] - 0.55 * p[i * 4];
  const { pts } = masks, c = N / 2;
  const score = (dx, dy, s) => {
    let sum = 0;
    for (let j = 0; j < pts.length; j += 2) {
      const x = Math.round((pts[j] - c) * s + c + dx), y = Math.round((pts[j + 1] - c) * s + c + dy);
      if (x >= 0 && y >= 0 && x < N && y < N) sum += gl[y * N + x];
    }
    return sum;
  };
  let best = masks.at, top = score(best.dx, best.dy, best.s);
  const search = (around, step, reach, scales) => {
    for (const s of scales) for (let dy = -reach; dy <= reach; dy += step) for (let dx = -reach; dx <= reach; dx += step) {
      const v = score(around.dx + dx, around.dy + dy, s);
      if (v > top) { top = v; best = { dx: around.dx + dx, dy: around.dy + dy, s }; }
    }
  };
  const s0 = masks.at.s;
  search(masks.at, 2, 10, [s0 * 0.97, s0, s0 * 1.03].map((s) => Math.min(1.15, Math.max(0.88, s))));
  search(best, 1, 1, [best.s * 0.99, best.s, best.s * 1.01]);
  masks.at = best;
  return best;
}

/** a mask moved and resized by `at` (nearest pixel) */
function moved(mask, at) {
  const out = new Float32Array(N * N), c = N / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = Math.round((x - c - at.dx) / at.s + c), v = Math.round((y - c - at.dy) / at.s + c);
    if (u >= 0 && v >= 0 && u < N && v < N) out[y * N + x] = mask[v * N + u];
  }
  return out;
}

/** Swaps the letters on the seal in the frame on `ctx` (in place). */
export function swapLetters(ctx, seal, masks) {
  const W = ctx.canvas.width, H = ctx.canvas.height, r = region(W, H, seal);
  const c = masks.canvas ?? (masks.canvas = work());
  const x = c.getContext("2d", { willReadFrequently: true });
  x.globalCompositeOperation = "copy";
  x.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, N, N);
  const img = x.getImageData(0, 0, N, N), p = img.data;
  const at = align(p, masks);
  const [oldM, core, newM, shade] = [masks.oldM, masks.core, masks.newM, masks.shade].map((m) => moved(m, at));
  // the wax around the old strokes, spread into them (blur of the known pixels, divided by their weight)
  const known = oldM.map((m) => 1 - m);
  const kw = blur(known, 7), fill = [0, 1, 2].map((k) => blur(Float32Array.from({ length: N * N }, (_, i) => p[i * 4 + k] * known[i]), 7));
  // this frame's gold, near each pixel (from the old strokes) and on average
  const gw = blur(core, 16), gold = [0, 1, 2].map((k) => blur(Float32Array.from({ length: N * N }, (_, i) => p[i * 4 + k] * core[i]), 16));
  const avg = [0, 0, 0]; let cn = 0;
  for (let i = 0; i < N * N; i++) if (core[i]) { avg[0] += p[i * 4]; avg[1] += p[i * 4 + 1]; avg[2] += p[i * 4 + 2]; cn++; }
  if (cn) avg.forEach((v, k) => { avg[k] = v / cn; });
  for (let i = 0; i < N * N; i++) {
    const m = oldM[i], q = newM[i], a = Math.max(m, q);
    if (a < 0.02) { p[i * 4 + 3] = 0; continue; }
    const near = smooth(gw[i], 0.01, 0.08);
    for (let k = 0; k < 3; k++) {
      const orig = p[i * 4 + k];
      const wax = kw[i] > 0.001 ? fill[k][i] / kw[i] : orig;
      const g = (gw[i] > 0.001 ? gold[k][i] / gw[i] : avg[k]) * near + avg[k] * (1 - near);
      const target = (orig * (1 - m) + wax * m) * (1 - q) + Math.min(255, g * shade[i]) * q;
      // stored so that drawing it with alpha `a` over the frame gives exactly `target`
      p[i * 4 + k] = Math.min(255, Math.max(0, (target - (1 - a) * orig) / a));
    }
    p[i * 4 + 3] = a * 255;
  }
  x.putImageData(img, 0, 0);
  ctx.drawImage(c, 0, 0, N, N, r.x, r.y, r.w, r.h);
}
