"use client";

/**
 * Google Takeout support for "Build a timeline from photos".
 *
 * A Google Photos export (takeout.google.com) puts a JSON "sidecar" next
 * to every photo with what Google knows about it — crucially the capture
 * time (`photoTakenTime`) and location (`geoData` / `geoDataExif`), which
 * Google keeps even for photos whose own EXIF was stripped (WhatsApp
 * saves, edited copies, uploads from other apps). Reading the sidecars is
 * what makes a Takeout zip a much better source than downloading photos
 * from photos.google.com, which loses the location.
 *
 * Sidecar naming has changed over the years and has quirks; all of these
 * appear in real exports and are handled by matching on the sidecar's own
 * `title` (the photo's original filename) within the same folder:
 *   IMG_1234.jpg.json
 *   IMG_1234.jpg.supplemental-metadata.json   (2024+, often truncated:
 *   IMG_1234.jpg.supplemental-metad.json        names are capped at ~51 chars)
 *   IMG_1234.jpg(1).json  ↔  IMG_1234(1).jpg  (a second photo with the same name)
 *   IMG_1234-edited.jpg   →  uses IMG_1234.jpg's sidecar
 * Sidecars and photos can land in different parts of a multi-zip export,
 * so the index is built across every zip the host picked.
 */

export interface TakeoutInfo {
  /** "YYYY-MM-DDTHH:mm" in the host's own timezone (Google stores UTC; the photo's own zone isn't in the sidecar). */
  takenAt: string | null;
  lat: number | null;
  lon: number | null;
}

interface SidecarJson {
  title?: unknown;
  photoTakenTime?: { timestamp?: unknown };
  geoData?: { latitude?: unknown; longitude?: unknown };
  geoDataExif?: { latitude?: unknown; longitude?: unknown };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localStamp(unixSeconds: number): string | null {
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Google writes 0,0 when there's no location. */
function coords(geo: SidecarJson["geoData"]): { lat: number; lon: number } | null {
  const lat = Number(geo?.latitude);
  const lon = Number(geo?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function dirOf(path: string) {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i + 1) : "";
}

function baseOf(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** "IMG_1234.jpg" + 1 → "IMG_1234(1).jpg" — how Takeout names the second photo with the same title. */
function withCopySuffix(title: string, n: string) {
  const dot = title.lastIndexOf(".");
  return dot > 0 ? `${title.slice(0, dot)}(${n})${title.slice(dot)}` : `${title}(${n})`;
}

export function isTakeoutSidecar(path: string) {
  return /\.json$/i.test(path);
}

export class TakeoutIndex {
  private byKey = new Map<string, TakeoutInfo>();

  get size() {
    return this.byKey.size;
  }

  /** Reads one .json file; anything that isn't a photo sidecar (album metadata.json, etc.) is ignored. */
  add(path: string, text: string) {
    let data: SidecarJson;
    try {
      data = JSON.parse(text) as SidecarJson;
    } catch {
      return;
    }
    if (!data || typeof data !== "object" || !data.photoTakenTime) return;

    const seconds = Number(data.photoTakenTime.timestamp);
    const place = coords(data.geoDataExif) ?? coords(data.geoData);
    const info: TakeoutInfo = {
      takenAt: Number.isFinite(seconds) && seconds > 0 ? localStamp(seconds) : null,
      lat: place?.lat ?? null,
      lon: place?.lon ?? null,
    };

    const dir = dirOf(path);
    const copy = baseOf(path).match(/\((\d+)\)\.json$/i)?.[1];
    if (typeof data.title === "string" && data.title) {
      this.byKey.set(dir + (copy ? withCopySuffix(data.title, copy) : data.title), info);
    }
    // Also by the sidecar's own name minus ".json" / ".supplemental-metadata…" — covers sidecars without a usable title.
    const stripped = baseOf(path)
      .replace(/(\(\d+\))?\.json$/i, "")
      .replace(/\.(s|su|sup|supp|suppl|supple|supplem|suppleme|supplemen|supplement|supplementa|supplemental)(-[a-z]*)?$/i, "");
    const key = dir + (copy ? withCopySuffix(stripped, copy) : stripped);
    if (!this.byKey.has(key)) this.byKey.set(key, info);
  }

  /** What Google knows about the photo at `path`, or null if it has no sidecar. */
  lookup(path: string): TakeoutInfo | null {
    const dir = dirOf(path);
    const name = baseOf(path);
    const exact = this.byKey.get(dir + name);
    if (exact) return exact;
    // An edited copy shares the original's sidecar (English export; other languages use their own word).
    const original = name.replace(/-(edited|bearbeitet|modifié|editado|modificato|bewerkt)(\(\d+\))?(\.[^.]+)$/i, "$3");
    return original !== name ? (this.byKey.get(dir + original) ?? null) : null;
  }
}
