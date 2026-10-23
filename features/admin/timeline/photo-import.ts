"use client";

import { compressImage } from "@/lib/image-compression";
import { readPhotoMetadata } from "@/lib/photo-metadata";
import { readZipEntries, type ZipEntry } from "@/features/admin/timeline/zip-reader";
import { TakeoutIndex, isTakeoutSidecar } from "@/features/admin/timeline/google-takeout";

/**
 * Browser-only half of "Build a timeline from photos": unzip (or take a
 * pile of picked photos), read each ORIGINAL file's date + GPS (EXIF —
 * lib/photo-metadata.ts; must happen before compression strips it), and
 * group them into would-be milestones. Nothing leaves the browser here
 * except, later, one small thumbnail per group (see makeThumbnailDataUrl).
 */

/** Photos are read lazily and Takeout sidecars skip the EXIF read, so a whole library is fine; the AI still sees ≤ MAX_GROUPS thumbnails. */
export const MAX_PHOTOS = 5000;
/** Matches MAX_TIMELINE_AI_GROUPS in services/timeline-ai.ts. */
export const MAX_GROUPS = 20;
/** Zips are read lazily from disk (zip-reader.ts), never uploaded — this is a sanity cap, not a memory limit. */
export const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024;

/** Photos further apart than this start a new milestone… */
const GAP_MS = 3 * 24 * 60 * 60 * 1000;
/** …and so do photos taken this far from where the group started. */
const DISTANCE_KM = 80;

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const VIDEO_EXTENSION = /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i;

export interface ImportedPhoto {
  id: string;
  name: string;
  /** The original bytes, read from the zip only when needed (thumbnail, upload). */
  getFile: () => Promise<File>;
  /** "YYYY-MM-DDTHH:mm", camera local time (EXIF) or the host's local time (Google sidecar). */
  takenAt: string | null;
  lat: number | null;
  lon: number | null;
  /** Identifies this photo across imports (see photoFingerprint) — how a re-import knows it's already on the timeline. */
  fingerprint: string;
}

export interface PhotoGroup {
  id: string;
  photos: ImportedPhoto[];
}

function imageType(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_TYPES[ext] ?? null;
}

function isZip(file: File) {
  return /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

/** Runs `fn` over `items` with at most `limit` in flight — reading 300 files at once stalls phones. */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** A photo found in what the host picked, not read yet. */
interface Candidate {
  /** Folder path inside its export, plus an export namespace — what sidecars are matched on. */
  path: string;
  name: string;
  size: number;
  getFile: () => Promise<File>;
}

/**
 * "takeout-20261024T101010Z-001.zip" and "-002.zip" are parts of ONE
 * Google export (a sidecar can sit in a different part from its photo),
 * while each Google account's export has its own timestamp — so the
 * namespace is the zip name minus the part number. That keeps
 * "Photos from 2019/IMG_0001.jpg" from two accounts apart.
 */
function exportNamespace(zipName: string) {
  return zipName.replace(/-\d{3}\.zip$/i, "").replace(/\.zip$/i, "") + ":";
}

/** Caches an entry's bytes only when that's free (stored); deflated entries are re-inflated on demand instead of all sitting in memory. */
function lazyFile(entry: ZipEntry, type: string): () => Promise<File> {
  let cached: Promise<File> | null = null;
  return () => {
    if (entry.stored) return (cached ??= entry.file(type));
    return entry.file(type);
  };
}

/** Photos (and Google Takeout sidecars) out of whatever the host picked: zips are opened, loose photos kept, the rest skipped. */
async function collect(picked: File[]): Promise<{ candidates: Candidate[]; takeout: TakeoutIndex; skipped: number; videos: number }> {
  const candidates: Candidate[] = [];
  const takeout = new TakeoutIndex();
  let skipped = 0;
  let videos = 0;

  for (const file of picked) {
    if (isZip(file)) {
      if (file.size > MAX_ZIP_BYTES) {
        throw new Error(`“${file.name}” is over 2 GB — please split it into smaller zips (Google Takeout: choose 2 GB parts).`);
      }
      let entries;
      try {
        entries = await readZipEntries(file);
      } catch {
        throw new Error(`Couldn't open “${file.name}” — is it a normal .zip file?`);
      }
      const ns = exportNamespace(file.name);
      for (const entry of entries) {
        const base = entry.name.split("/").pop() ?? "";
        // macOS adds __MACOSX/._photo.jpg resource forks — not real photos.
        if (entry.name.startsWith("__MACOSX/") || base.startsWith(".")) continue;
        if (isTakeoutSidecar(entry.name)) {
          // Sidecars are ~1 KB; anything bigger isn't one.
          if (entry.size < 200_000) takeout.add(ns + entry.name, await (await entry.file("application/json")).text());
          continue;
        }
        const type = imageType(entry.name);
        if (!type) {
          if (VIDEO_EXTENSION.test(entry.name)) videos++;
          else skipped++;
          continue;
        }
        candidates.push({ path: ns + entry.name, name: base, size: entry.size, getFile: lazyFile(entry, type) });
      }
    } else if (isTakeoutSidecar(file.name)) {
      takeout.add(file.name, await file.text());
    } else if (file.type.startsWith("image/") || imageType(file.name)) {
      candidates.push({ path: file.name, name: file.name, size: file.size, getFile: () => Promise.resolve(file) });
    } else if (VIDEO_EXTENSION.test(file.name) || file.type.startsWith("video/")) {
      videos++;
    } else {
      skipped++;
    }
  }
  return { candidates, takeout, skipped, videos };
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Drops byte-identical copies — the same photo appears once per album in
 * a Takeout export, and again in a second account's export. Different
 * photos that merely share a filename are kept. Only files whose size
 * collides are ever read (first + last 64 KB, hashed), so this stays cheap
 * on big libraries.
 */
async function dropDuplicates(candidates: Candidate[]): Promise<{ unique: Candidate[]; duplicates: number }> {
  const bySize = new Map<number, Candidate[]>();
  for (const c of candidates) bySize.set(c.size, [...(bySize.get(c.size) ?? []), c]);

  const unique: Candidate[] = [];
  for (const group of bySize.values()) {
    if (group.length === 1) {
      unique.push(...group);
      continue;
    }
    const seen = new Set<string>();
    for (const c of group) {
      const fingerprint = await contentHash(await c.getFile());
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      unique.push(c);
    }
  }
  const order = new Map(candidates.map((c, i) => [c, i]));
  unique.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return { unique, duplicates: candidates.length - unique.length };
}

export interface ReadPhotosResult {
  photos: ImportedPhoto[];
  skipped: number;
  /** Videos found (the timeline import is photos-only — videos are added to a milestone one at a time). */
  videos: number;
  /** Byte-identical copies dropped. */
  duplicates: number;
  /** Photos whose date/place came from Google Takeout sidecars. */
  fromGoogle: number;
  /** Photos dated only by their filename (IMG_20190615_…, WhatsApp IMG-20200101-WA…). */
  fromFileName: number;
  /** Photos beyond MAX_PHOTOS that were left out. */
  overLimit: number;
}

export async function readPhotos(
  picked: File[],
  onProgress?: (message: string) => void,
): Promise<ReadPhotosResult> {
  const { candidates, takeout, skipped, videos } = await collect(picked);
  onProgress?.(`Checking ${candidates.length} photos for duplicates…`);
  const { unique, duplicates } = await dropDuplicates(candidates);
  const kept = unique.slice(0, MAX_PHOTOS);

  let done = 0;
  let fromGoogle = 0;
  let fromFileName = 0;
  const photos = await mapLimited(kept, 4, async (c, i): Promise<ImportedPhoto> => {
    const google = takeout.lookup(c.path);
    if (google && (google.takenAt || google.lat !== null)) fromGoogle++;
    // The photo's own EXIF has the true local wall-clock time; Google's sidecar fills whatever it lacks.
    // Skip reading the file at all when the sidecar already has both — that's what keeps big exports fast.
    const exif =
      google?.takenAt && google.lat !== null ? null : await c.getFile().then(readPhotoMetadata).catch(() => null);
    onProgress?.(`Reading dates and places… ${++done} of ${kept.length}`);
    const gps = exif?.lat != null && exif.lon != null ? exif : google?.lat != null && google.lon != null ? google : null;
    const recorded = exif?.takenAt ?? google?.takenAt ?? null;
    // Last resort only: a filename date never overrides a real capture date.
    const named = recorded ? null : dateFromFileName(c.name);
    if (named) fromFileName++;
    return {
      id: `p${i}`,
      name: c.name,
      getFile: c.getFile,
      takenAt: recorded ?? named,
      lat: gps?.lat ?? null,
      lon: gps?.lon ?? null,
      fingerprint: await photoFingerprint(c.size, recorded, c.getFile),
    };
  });
  return { photos, skipped, videos, duplicates, fromGoogle, fromFileName, overLimit: unique.length - kept.length };
}

/** SHA-256 of a file's first and last 64 KB — cheap, and different for any two real photos. */
async function contentHash(file: File): Promise<string> {
  return sha256(new Blob([file.slice(0, 65_536), file.slice(Math.max(0, file.size - 65_536))]));
}

/**
 * Identifies the ORIGINAL photo across imports, Takeout parts and Google
 * accounts. With a recorded capture time (EXIF / Google), byte size + that
 * minute is unique in practice and needs no file read — important for
 * deflated Takeout zips. Otherwise the content is hashed. Always computed
 * from the original, never the compressed upload.
 */
export async function photoFingerprint(size: number, recordedTakenAt: string | null, getFile: () => Promise<File>): Promise<string> {
  if (recordedTakenAt) return `s${size}-t${recordedTakenAt.replace(/[^0-9]/g, "")}`;
  return `s${size}-h${(await contentHash(await getFile())).slice(0, 32)}`;
}

/** Everything the import knows about one picked file — used by "Add more photos" on a milestone. */
export async function describePhotoFile(file: File): Promise<Pick<ImportedPhoto, "takenAt" | "lat" | "lon" | "fingerprint">> {
  const meta = await readPhotoMetadata(file);
  return {
    takenAt: meta.takenAt ?? dateFromFileName(file.name),
    lat: meta.lat,
    lon: meta.lon,
    fingerprint: await photoFingerprint(file.size, meta.takenAt, () => Promise.resolve(file)),
  };
}

const FILE_NAME_DATES: { pattern: RegExp; hasTime: boolean }[] = [
  // IMG_20190615_101010.jpg, PXL_20190615_101010123.jpg, VID_…, 20190615_101010.jpg (Android cameras)
  { pattern: /(?:^|[^0-9])((?:19|20)\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/, hasTime: true },
  // Screenshot_2019-06-15-10-10-10.png, 2019-06-15 10.10.10.jpg (Dropbox), signal-2020-01-01-101010.jpg
  { pattern: /((?:19|20)\d{2})-(\d{2})-(\d{2})[ _-](\d{2})[.:-]?(\d{2})[.:-]?(\d{2})/, hasTime: true },
  // IMG-20200101-WA0001.jpg (WhatsApp — date only)
  { pattern: /-((?:19|20)\d{2})(\d{2})(\d{2})-WA\d+/i, hasTime: false },
  // Anything else with a plain 2019-06-15
  { pattern: /(?:^|[^0-9])((?:19|20)\d{2})-(\d{2})-(\d{2})(?:[^0-9]|$)/, hasTime: false },
];

/** "YYYY-MM-DDTHH:mm" from a camera/app filename, or null. Date-only names get midnight. */
export function dateFromFileName(name: string): string | null {
  for (const { pattern, hasTime } of FILE_NAME_DATES) {
    const m = name.match(pattern);
    if (!m) continue;
    const [mo, d] = [Number(m[2]), Number(m[3])];
    const [h, mi, se] = hasTime ? [Number(m[4]), Number(m[5]), Number(m[6])] : [0, 0, 0];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) continue;
    const stamp = `${m[1]}-${m[2]}-${m[3]}T${hasTime ? `${m[4]}:${m[5]}` : "00:00"}`;
    const when = Date.parse(stamp);
    // Not in the future, and a real calendar day (rejects 2019-02-31).
    if (Number.isNaN(when) || when > Date.now() + 86_400_000 || new Date(when).getDate() !== d) continue;
    return stamp;
  }
  return null;
}

function time(photo: ImportedPhoto): number {
  return photo.takenAt ? Date.parse(photo.takenAt) : NaN;
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function groupLocation(group: PhotoGroup): { lat: number; lon: number } | null {
  const withGps = group.photos.find((p) => p.lat !== null && p.lon !== null);
  return withGps && withGps.lat !== null && withGps.lon !== null ? { lat: withGps.lat, lon: withGps.lon } : null;
}

/**
 * Dated photos: oldest first, a new group whenever there's a gap of a few
 * days or the photos move far from where the group started (a trip, a
 * wedding weekend and a birthday become three milestones). Then the
 * closest-together neighbours are merged until it fits MAX_GROUPS.
 *
 * Undated photos (WhatsApp copies, most scans) each become their own
 * milestone — the AI estimates their decade from the picture — chunked
 * together only if there are too many.
 */
export function groupPhotos(photos: ImportedPhoto[]): PhotoGroup[] {
  const dated = photos.filter((p) => !Number.isNaN(time(p))).sort((a, b) => time(a) - time(b));
  const undated = photos.filter((p) => Number.isNaN(time(p)));

  const datedGroups: ImportedPhoto[][] = [];
  for (const photo of dated) {
    const current = datedGroups[datedGroups.length - 1];
    const last = current?.[current.length - 1];
    let startNew = !current || !last || time(photo) - time(last) > GAP_MS;
    if (!startNew && current && photo.lat !== null && photo.lon !== null) {
      const anchor = groupLocation({ id: "", photos: current });
      if (anchor && distanceKm(anchor.lat, anchor.lon, photo.lat, photo.lon) > DISTANCE_KM) startNew = true;
    }
    if (startNew || !current) datedGroups.push([photo]);
    else current.push(photo);
  }

  // Undated photos are guaranteed up to half the milestones; dated ones get the rest.
  const datedBudget = MAX_GROUPS - Math.min(undated.length, MAX_GROUPS / 2);
  while (datedGroups.length > datedBudget) {
    // Merge the neighbouring pair with the smallest time gap between them — weighted by size, so
    // evenly spaced photos (one a year) merge into even groups instead of snowballing into one.
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < datedGroups.length - 1; i++) {
      const a = datedGroups[i];
      const b = datedGroups[i + 1];
      const lastOfA = a?.[a.length - 1];
      const firstOfB = b?.[0];
      if (!a || !b || !lastOfA || !firstOfB) continue;
      const gap = (time(firstOfB) - time(lastOfA) + 1) * (a.length + b.length);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    const merged = [...(datedGroups[best] ?? []), ...(datedGroups[best + 1] ?? [])];
    datedGroups.splice(best, 2, merged);
  }

  const undatedSlots = Math.min(undated.length, MAX_GROUPS - datedGroups.length);
  const undatedGroups: ImportedPhoto[][] = [];
  if (undatedSlots > 0) {
    const size = Math.ceil(undated.length / undatedSlots);
    for (let i = 0; i < undated.length; i += size) undatedGroups.push(undated.slice(i, i + size));
  }

  return [...datedGroups, ...undatedGroups].map((groupPhotos, i) => ({ id: `g${i}-${groupPhotos[0]?.id ?? ""}`, photos: groupPhotos }));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(takenAt: string) {
  return { y: Number(takenAt.slice(0, 4)), m: Number(takenAt.slice(5, 7)), d: Number(takenAt.slice(8, 10)) };
}

/** "March 1998" (one month), "1998" (one year) or "1998–2001" — fits the milestone's Period field. */
export function groupPeriod(group: PhotoGroup): string | null {
  const dated = group.photos.filter((p) => p.takenAt).map((p) => p.takenAt as string).sort();
  const first = dated[0];
  const last = dated[dated.length - 1];
  if (!first || !last) return null;
  const a = parts(first);
  const b = parts(last);
  if (a.y !== b.y) return `${a.y}–${b.y}`;
  if (a.m !== b.m) return String(a.y);
  return `${MONTHS[a.m - 1] ?? ""} ${a.y}`;
}

/** "14 March 1998", "14–16 March 1998", "March–May 1998", "1998–2001" — exact span for the AI and the review card. */
export function groupDateLabel(group: PhotoGroup): string | null {
  const dated = group.photos.filter((p) => p.takenAt).map((p) => p.takenAt as string).sort();
  const first = dated[0];
  const last = dated[dated.length - 1];
  if (!first || !last) return null;
  const a = parts(first);
  const b = parts(last);
  const month = (m: number) => MONTHS[m - 1] ?? "";
  if (a.y !== b.y) return `${month(a.m)} ${a.y} – ${month(b.m)} ${b.y}`;
  if (a.m !== b.m) return `${month(a.m)}–${month(b.m)} ${a.y}`;
  if (a.d !== b.d) return `${a.d}–${b.d} ${month(a.m)} ${a.y}`;
  return `${a.d} ${month(a.m)} ${a.y}`;
}

/** The middle photo — usually more representative than the first test shot of a set. */
export function defaultCover(group: PhotoGroup): ImportedPhoto | undefined {
  return group.photos[Math.floor((group.photos.length - 1) / 2)];
}

/** ~320px JPEG data: URL — what the AI sees for a group (it looks at low detail anyway). Also converts HEIC. */
export async function makeThumbnailDataUrl(file: File): Promise<string> {
  const small = await compressImage(file, { maxDimension: 320, quality: 0.7 });
  if (small.type !== "image/jpeg") throw new Error(`Couldn't read “${file.name}”.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Couldn't read “${file.name}”.`));
    reader.readAsDataURL(small);
  });
}

/** First 4-digit year in a period ("March 1998", "1960s", "1998–2001") — used to slot AI-dated scans into order. */
export function periodYear(period: string): number | null {
  const match = period.match(/\b(1[89]\d\d|20\d\d)/);
  return match ? Number(match[1]) : null;
}
