"use client";

import { useState } from "react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import type { TimelineMilestonePhoto } from "@/types/content";

/** Thumbnails shown before "+N"; tapping any opens the full set. */
const VISIBLE = 6;

/**
 * A milestone's extra photos (timeline_milestone_photos) under its main
 * photo on the public Timeline: a row of small thumbnails that open a
 * swipeable lightbox of the main photo plus all of them. Renders nothing
 * when a milestone has no extra photos, so existing timelines look exactly
 * as before.
 */
export function MilestonePhotoStrip({
  title,
  coverUrl,
  photos,
}: {
  title: string;
  /** The milestone's main photo (not a video) — first in the lightbox. */
  coverUrl: string | null;
  photos: TimelineMilestonePhoto[];
}) {
  const [index, setIndex] = useState<number | null>(null);
  if (photos.length === 0) return null;

  const slides = [...(coverUrl ? [{ key: "cover", src: coverUrl }] : []), ...photos.map((p) => ({ key: p.id, src: p.url }))];
  const offset = coverUrl ? 1 : 0;
  const hidden = photos.length - VISIBLE;
  const contributors = [...new Set(photos.map((p) => p.contributedBy).filter((n): n is string => Boolean(n)))];

  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label={`More photos from ${title}`}>
        {photos.slice(0, VISIBLE).map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(i + offset)}
              aria-label={`Open photo ${i + 1} of ${photos.length} from ${title}`}
              className="relative block h-14 w-14 overflow-hidden rounded-lg border border-gold-500/15 sm:h-16 sm:w-16"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover transition-opacity hover:opacity-80" />
              {i === VISIBLE - 1 && hidden > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-950/60 text-sm font-medium text-ivory-50">
                  +{hidden}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {contributors.length > 0 ? (
        <p className="mt-2 text-xs text-ivory-100/50">Photos shared by {contributors.join(", ")}</p>
      ) : null}
      <PhotoSlider
        images={slides}
        visible={index !== null}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </>
  );
}
