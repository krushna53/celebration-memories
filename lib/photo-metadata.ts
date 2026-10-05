/**
 * Browser-only. Reads when (and where) a photo was taken, before
 * upload — used to pre-fill Timeline milestones and to give the Gallery's
 * AI captions real context (features/admin/timeline/timeline-manager.tsx,
 * features/admin/gallery/gallery-manager.tsx).
 *
 * Must run on the ORIGINAL file: lib/image-compression.ts re-encodes
 * through <canvas>, which drops all EXIF. `exifr` is loaded lazily so
 * pages only download it once someone actually picks a photo; it also
 * reads iPhone HEIC files.
 *
 * Where the data survives (worth knowing for help text):
 *  - Original files (Google Drive / Files app / "Browse", camera roll on
 *    most iPhones) keep both the date and GPS.
 *  - Android's built-in photo picker keeps the date but removes GPS for
 *    privacy.
 *  - Google Photos imports (GooglePhotosButton) arrive as a resized copy
 *    with no EXIF — their capture time comes from the Picker API instead
 *    and is attached via rememberPhotoTakenAt. Google never shares GPS
 *    through that API.
 *  - WhatsApp/Instagram/Facebook copies have neither.
 */

export interface PhotoMetadata {
  /** Wall-clock time the photo was taken, "YYYY-MM-DDTHH:mm" (camera local time — EXIF has no reliable zone). */
  takenAt: string | null;
  lat: number | null;
  lon: number | null;
}

const EMPTY: PhotoMetadata = { takenAt: null, lat: null, lon: null };

/** Capture times for files that arrive without EXIF (Google Photos imports) — keyed by the File object itself. */
const takenAtHints = new WeakMap<File, string>();

export function rememberPhotoTakenAt(file: File, isoOrLocal: string) {
  const local = toLocalStamp(isoOrLocal);
  if (local) takenAtHints.set(file, local);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalStamp(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // exifr returns EXIF DateTimeOriginal as a Date built from the camera's wall-clock fields in local time.
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : toLocalStamp(d);
  }
  return null;
}

/** Dates before photography was common or in the future are almost always a wrong camera clock — ignore them. */
function plausible(stamp: string | null): string | null {
  if (!stamp) return null;
  const year = Number(stamp.slice(0, 4));
  return year >= 1900 && Date.parse(stamp) <= Date.now() + 24 * 60 * 60 * 1000 ? stamp : null;
}

export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  const hinted = takenAtHints.get(file) ?? null;
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) return { ...EMPTY, takenAt: hinted };

  try {
    const { default: exifr } = await import("exifr");
    const data = (await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"],
      gps: true,
    })) as { DateTimeOriginal?: unknown; CreateDate?: unknown; latitude?: number; longitude?: number } | undefined;

    const takenAt = plausible(toLocalStamp(data?.DateTimeOriginal ?? data?.CreateDate)) ?? hinted;
    const lat = typeof data?.latitude === "number" && Number.isFinite(data.latitude) ? data.latitude : null;
    const lon = typeof data?.longitude === "number" && Number.isFinite(data.longitude) ? data.longitude : null;
    // 0,0 is "no fix" on some cameras, not the Gulf of Guinea.
    const hasGps = lat !== null && lon !== null && !(lat === 0 && lon === 0);
    return { takenAt, lat: hasGps ? lat : null, lon: hasGps ? lon : null };
  } catch {
    return { ...EMPTY, takenAt: hinted };
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "March 1998" — fits a Timeline milestone's Period field. */
export function formatTakenMonth(takenAt: string): string {
  const [y, m] = takenAt.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y}`.trim();
}

/** "14 March 1998". */
export function formatTakenDay(takenAt: string): string {
  const [y, m, rest] = takenAt.split("-");
  return `${Number(rest?.slice(0, 2))} ${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}
