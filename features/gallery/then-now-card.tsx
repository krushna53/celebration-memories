"use client";

import { useState } from "react";
import Image from "next/image";

import type { GalleryPairRecord } from "@/types/content";

/** "…, 1970s" from a caption, for the "Then" label. */
function decadeLabel(caption: string | null): string | null {
  return caption?.match(/\b(1[89]\d0|20\d0)s\b/)?.[0] ?? null;
}

/**
 * Drag-to-compare "Then & Now": the old photo sits on top of the recent
 * one and is revealed up to the handle. A native range input drives it,
 * so it works with touch, mouse and keyboard (arrow keys) alike.
 */
export function ThenNowCard({ pair }: { pair: GalleryPairRecord }) {
  const [position, setPosition] = useState(50);
  const thenLabel = decadeLabel(pair.thenPhoto.caption) ?? "Then";

  return (
    <figure className="overflow-hidden rounded-2xl border border-navy-950/10 bg-ivory-50">
      <div className="relative aspect-[4/5] select-none">
        <Image
          src={pair.nowPhoto.url}
          alt={pair.nowPhoto.caption ?? "Now"}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <Image
            src={pair.thenPhoto.url}
            alt={pair.thenPhoto.caption ?? "Then"}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-ivory-50 shadow" style={{ left: `${position}%` }}>
          <span className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ivory-50 text-xs text-navy-950 shadow">
            ⇆
          </span>
        </div>
        <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-navy-950/70 px-2.5 py-1 text-[11px] uppercase tracking-widest text-ivory-50">
          {thenLabel}
        </span>
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-gold-500/90 px-2.5 py-1 text-[11px] uppercase tracking-widest text-navy-950">
          Now
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="Drag to compare then and now"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      {pair.caption ? <figcaption className="px-4 py-3 text-center font-display text-base text-navy-950">{pair.caption}</figcaption> : null}
    </figure>
  );
}
