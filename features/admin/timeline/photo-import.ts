"use client";

import { compressImage } from "@/lib/image-compression";
import { readPhotoMetadata } from "@/lib/photo-metadata";
import { readZipEntries } from "@/features/admin/timeline/zip-reader";

/**
 * Browser-only half of "Build a timeline from photos": unzip (or take a
 * pile of picked photos), read each ORIGINAL file's date + GPS (EXIF —
 * lib/photo-metadata.ts; must happen before compression strips it), and
 * group them into would-be milestones. Nothing leaves the browser here
 * except, later, one small thumbnail per group (see makeThumbnailDataUrl).
 */

export const MAX_PHOTOS = 1000;
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

export interface ImportedPhoto {
  id: string;
  file: File;
  /** "YYYY-MM-DDTHH:mm", camera local time. */
  takenAt: string | null;
  lat: number | null;
  lon: number | null;
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

/** Image files out of whatever the host picked: zips are opened, loose photos are kept, everything else is skipped. */
async function collectImageFiles(picked: File[]): Promise<{ files: File[]; skipped: number; overLimit: number }> {
  const files: File[] = [];
  let skipped = 0;
  let overLimit = 0;

  for (const file of picked) {
    if (isZip(file)) {
      if (file.size > MAX_ZIP_BYTES) {
        throw new Error(`“${file.name}” is over 2 GB — please split it into smaller zips.`);
      }
      let entries;
      try {
        entries = await readZipEntries(file);
      } catch {
        throw new Error(`Couldn't open “${file.name}” — is it a normal .zip file?`);
      }
      for (const entry of entries) {
        const base = entry.name.split("/").pop() ?? "";
        // macOS adds __MACOSX/._photo.jpg resource forks — not real photos.
        if (entry.name.startsWith("__MACOSX/") || base.startsWith(".")) continue;
        const type = imageType(entry.name);
        if (!type) {
          skipped++;
          continue;
        }
        if (files.length >= MAX_PHOTOS) {
          // Count it as over the limit without reading it.
          overLimit++;
          continue;
        }
        files.push(await entry.file(type));
      }
    } else if (file.type.startsWith("image/") || imageType(file.name)) {
      files.push(file);
    } else {
      skipped++;
    }
  }
  return { files, skipped, overLimit };
}

export interface ReadPhotosResult {
  photos: ImportedPhoto[];
  skipped: number;
  /** Photos beyond MAX_PHOTOS that were left out. */
  overLimit: number;
}

export async function readPhotos(picked: File[], onProgress?: (done: number, total: number) => void): Promise<ReadPhotosResult> {
  const { files, skipped, overLimit: zipOverLimit } = await collectImageFiles(picked);
  const kept = files.slice(0, MAX_PHOTOS);
  let done = 0;
  const photos = await mapLimited(kept, 4, async (file, i) => {
    const meta = await readPhotoMetadata(file);
    onProgress?.(++done, kept.length);
    return { id: `p${i}`, file, takenAt: meta.takenAt, lat: meta.lat, lon: meta.lon };
  });
  return { photos, skipped, overLimit: zipOverLimit + files.length - kept.length };
}

function time(photo: ImportedPhoto): number {
  return photo.takenAt ? Date.parse(photo.takenAt) : NaN;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
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
