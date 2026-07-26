"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  type GalleryCategory,
} from "@/features/gallery/gallery-data";

/**
 * Masonry photo gallery with category filtering and a full-screen
 * lightbox (react-photo-view). Images are lazy-loaded via next/image.
 * Shows a graceful empty state per category until real photos are
 * added to gallery-data.ts.
 */
export function GallerySection() {
  const [active, setActive] = useState<GalleryCategory | "all">("all");

  const items = useMemo(
    () =>
      active === "all"
        ? GALLERY_ITEMS
        : GALLERY_ITEMS.filter((item) => item.category === active),
    [active],
  );

  return (
    <section id="gallery" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Cherished Moments"
            title="Gallery"
            description="A lifetime of memories — from childhood to grandchildren."
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
                    className="mb-4 overflow-hidden rounded-xl break-inside-avoid border border-navy-950/5"
                  >
                    <PhotoView src={item.src}>
                      <div className="relative cursor-zoom-in">
                        <Image
                          src={item.src}
                          alt={item.alt}
                          width={600}
                          height={800}
                          loading="lazy"
                          className="h-auto w-full object-cover transition-luxury duration-500 hover:scale-105"
                        />
                      </div>
                    </PhotoView>
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
