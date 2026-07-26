"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

interface GallerySectionProps {
  photos: GalleryPhotoRecord[];
}

/**
 * Masonry photo gallery with category filtering and a full-screen
 * lightbox (react-photo-view). Images are lazy-loaded via next/image.
 * Sourced from admin-curated `gallery_photos` (see /admin/gallery) —
 * shows a graceful empty state per category until photos are added.
 */
export function GallerySection({ photos }: GallerySectionProps) {
  const [active, setActive] = useState<GalleryCategory | "all">("all");

  const items = useMemo(
    () => (active === "all" ? photos : photos.filter((item) => item.category === active)),
    [active, photos],
  );

  return (
    <section id="gallery" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Cherished Moments"
            title="Gallery"
            description="A lifetime of memories, shared by the family."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
            role="tablist"
            aria-label="Gallery categories"
          >
            {GALLERY_CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                role="tab"
                aria-selected={active === category.value}
                onClick={() => setActive(category.value)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.15em] transition-luxury duration-300 sm:text-sm",
                  active === category.value
                    ? "border-gold-500 bg-gold-500 text-navy-950"
                    : "border-navy-950/15 text-navy-700/70 hover:border-gold-400 hover:text-navy-950",
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2} className="mt-12">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-20 text-center text-navy-700/50">
              <ImageOff size={28} />
              <p className="text-sm">
                Photos for this category are coming soon.
              </p>
            </div>
          ) : (
            <PhotoProvider>
              <div className="columns-2 gap-4 sm:columns-3 [column-fill:_balance]">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative mb-4 overflow-hidden rounded-xl break-inside-avoid border border-navy-950/5"
                  >
                    <PhotoView src={item.url}>
                      <div className="relative cursor-zoom-in">
                        <Image
                          src={item.url}
                          alt={item.caption ?? ""}
                          width={600}
                          height={800}
                          loading="lazy"
                          className="h-auto w-full object-cover transition-luxury duration-500 hover:scale-105"
                        />
                      </div>
                    </PhotoView>
                    <MediaShareButtons
                      url={item.url}
                      fileNameBase={`gallery-${item.category}`}
                      shareText={item.caption ?? undefined}
                      className="absolute right-2 top-2 flex gap-1.5"
                    />
                  </div>
                ))}
              </div>
            </PhotoProvider>
          )}
        </Reveal>
      </div>
    </section>
  );
}
