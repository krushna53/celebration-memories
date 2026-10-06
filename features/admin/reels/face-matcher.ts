"use client";

/**
 * In-browser face recognition for Guest Reels, using @vladmandic/face-api
 * (TensorFlow.js; SSD MobileNet detector + 68-point landmarks + a 128-d
 * face-recognition embedding). It runs entirely on the host's device:
 * reference photos and event photos are read through our own signed
 * /media links, and only the outcome — which consenting person appears
 * in which photo, and where — is sent back to the server. No face
 * embeddings are stored anywhere, and no photo goes to a third-party AI.
 *
 * Loaded at runtime from jsDelivr (≈ 1.3 MB script + ≈ 12 MB of model
 * weights, cached by the browser after the first scan) rather than
 * bundled, so it costs nothing for every other page of the app.
 */

const CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15";

/** Max euclidean distance between embeddings to count as the same person (library default is 0.6; stricter = fewer wrong matches). */
export const MATCH_THRESHOLD = 0.5;
/** A match must be clearly closer than the next-closest person (best < runner-up × this), so lookalikes aren't confused. */
const AMBIGUITY_RATIO = 0.9;
/** Faces narrower than this (pixels, at scan size) are ignored. */
const MIN_FACE_PX = 36;
/** Photos are downscaled to this before detection — plenty for faces, much faster on phones. */
const MAX_SCAN_DIMENSION = 1400;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Detection {
  detection: { box: Box; score: number };
  descriptor: Float32Array;
}
interface FaceApi {
  nets: Record<"ssdMobilenetv1" | "faceLandmark68Net" | "faceRecognitionNet", { loadFromUri(uri: string): Promise<void> }>;
  SsdMobilenetv1Options: new (options: { minConfidence: number; maxResults?: number }) => unknown;
  detectAllFaces(
    input: HTMLCanvasElement,
    options: unknown,
  ): { withFaceLandmarks(): { withFaceDescriptors(): Promise<Detection[]> } };
  euclideanDistance(a: Float32Array, b: Float32Array): number;
  tf?: { ready(): Promise<void> };
}

let loading: Promise<FaceApi> | null = null;

/** A real dynamic import of a URL — hidden from the bundler, which would otherwise try to resolve it at build time. */
const importFromUrl = new Function("url", "return import(url)") as (url: string) => Promise<FaceApi & { default?: FaceApi }>;

export function loadFaceApi(): Promise<FaceApi> {
  if (!loading) {
    loading = (async () => {
      const mod = await importFromUrl(`${CDN}/dist/face-api.esm.js`);
      const api = (mod.nets ? mod : mod.default) as FaceApi;
      await api.tf?.ready();
      await Promise.all([
        api.nets.ssdMobilenetv1.loadFromUri(`${CDN}/model`),
        api.nets.faceLandmark68Net.loadFromUri(`${CDN}/model`),
        api.nets.faceRecognitionNet.loadFromUri(`${CDN}/model`),
      ]);
      return api;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

async function loadCanvas(url: string): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load photo (${res.status})`);
  const bitmap = await createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { canvas, ...size };
}

async function detect(api: FaceApi, canvas: HTMLCanvasElement, minConfidence: number) {
  return api
    .detectAllFaces(canvas, new api.SsdMobilenetv1Options({ minConfidence, maxResults: 60 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
}

export interface Reference {
  key: string;
  name: string;
  descriptor: Float32Array;
}

/** The largest face in a reference photo is taken to be the person. Returns null when no face is found. */
export async function buildReference(api: FaceApi, ref: { key: string; name: string; url: string }): Promise<Reference | null> {
  const { canvas } = await loadCanvas(ref.url);
  const faces = await detect(api, canvas, 0.3);
  if (faces.length === 0) return null;
  const largest = faces.reduce((a, b) =>
    a.detection.box.width * a.detection.box.height >= b.detection.box.width * b.detection.box.height ? a : b,
  );
  return { key: ref.key, name: ref.name, descriptor: largest.descriptor };
}

export interface MatchedFace {
  key: string;
  distance: number;
  box: { x: number; y: number; w: number; h: number };
}

export interface PhotoScanResult {
  width: number;
  height: number;
  faceCount: number;
  faces: MatchedFace[];
}

/**
 * Detects every face in a photo and assigns each to its closest
 * reference under MATCH_THRESHOLD. Greedy by distance, so one person is
 * matched at most once per photo and two lookalike faces can't both be
 * labelled as the same guest.
 */
export async function scanPhoto(api: FaceApi, url: string, references: Reference[]): Promise<PhotoScanResult> {
  const { canvas, width, height } = await loadCanvas(url);
  const faces = await detect(api, canvas, 0.45);

  const pairs: { face: number; ref: number; distance: number }[] = [];
  faces.forEach((f, fi) => {
    // Tiny background faces give unreliable embeddings — better to miss them than mislabel them.
    if (f.detection.box.width < MIN_FACE_PX) return;
    const distances = references.map((r) => api.euclideanDistance(f.descriptor, r.descriptor));
    const sorted = [...distances].sort((a, b) => a - b);
    const best = sorted[0] ?? Infinity;
    const runnerUp = sorted[1] ?? Infinity;
    // Ratio test: if this face is nearly as close to a second person, it's ambiguous — skip it rather than guess.
    if (best >= MATCH_THRESHOLD || best > runnerUp * AMBIGUITY_RATIO) return;
    pairs.push({ face: fi, ref: distances.indexOf(best), distance: best });
  });
  pairs.sort((a, b) => a.distance - b.distance);

  const usedFaces = new Set<number>();
  const usedRefs = new Set<number>();
  const matched: MatchedFace[] = [];
  for (const p of pairs) {
    if (usedFaces.has(p.face) || usedRefs.has(p.ref)) continue;
    usedFaces.add(p.face);
    usedRefs.add(p.ref);
    const box = faces[p.face]!.detection.box;
    matched.push({
      key: references[p.ref]!.key,
      distance: Math.round(p.distance * 1000) / 1000,
      box: {
        x: box.x / canvas.width,
        y: box.y / canvas.height,
        w: box.width / canvas.width,
        h: box.height / canvas.height,
      },
    });
  }
  return { width, height, faceCount: faces.length, faces: matched };
}
