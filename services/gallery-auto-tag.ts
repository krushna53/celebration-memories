import "server-only";

import { isVideoMedia } from "@/lib/curated-media";
import { AI_GALLERY_TAGGER_CONFIGURED, suggestGalleryTags } from "@/lib/ai-gallery-tagger";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { externalMediaUrl } from "@/services/external-media";
import type { GalleryCategory } from "@/features/gallery/gallery-data";

/** What the browser read from the original file before upload (lib/photo-metadata.ts) plus the host's choice. */
export interface GalleryUploadOptions {
  /** Let AI pick the category and write the caption. */
  autoTag?: boolean;
  /** "YYYY-MM-DDTHH:mm" from EXIF / Google Photos. */
  takenAt?: string | null;
  lat?: number | null;
  lon?: number | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function takenLabel(takenAt: string | null | undefined): string | null {
  const m = takenAt?.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim();
}

/**
 * Decides the category + caption a newly uploaded gallery item is saved
 * with. Order of precedence for the caption: what the host typed → the
 * AI's caption (which is told the photo's real date/place) → a plain
 * "Lonavala, Maharashtra · March 1998" from the file's own metadata.
 * The category is the AI's pick when auto-tagging, else the host's.
 * Everything stays editable afterwards in the gallery manager.
 *
 * Never throws — a failed lookup or AI call just falls back, so the
 * upload itself always succeeds.
 */
export async function resolveGalleryUpload(params: {
  path: string;
  category: GalleryCategory;
  caption: string;
  options?: GalleryUploadOptions;
}): Promise<{ category: GalleryCategory; caption: string; autoTagged: boolean }> {
  const { path, options = {} } = params;
  const typed = params.caption.trim();

  const place =
    typeof options.lat === "number" && typeof options.lon === "number"
      ? await reverseGeocode(options.lat, options.lon)
      : null;
  const taken = takenLabel(options.takenAt);
  const metadataCaption = [place, taken].filter(Boolean).join(" · ");

  if (options.autoTag && AI_GALLERY_TAGGER_CONFIGURED && !isVideoMedia(path)) {
    try {
      const url = await externalMediaUrl("gallery", path, 600);
      const suggestion = await suggestGalleryTags(url, { taken, place });
      return { category: suggestion.category, caption: typed || suggestion.caption, autoTagged: true };
    } catch (err) {
      console.error("resolveGalleryUpload auto-tag failed:", err);
    }
  }

  return { category: params.category, caption: typed || metadataCaption, autoTagged: false };
}
