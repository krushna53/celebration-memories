"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, X } from "lucide-react";

import type { VideoTestimonial } from "@/lib/video-testimonials";

/**
 * Portrait reel card: plays silently on loop while on screen (the reel has
 * burned-in captions, so it reads fine muted), and opens a full-screen
 * player with sound when tapped. Respects prefers-reduced-motion by not
 * autoplaying. Video only loads once the card is near the viewport.
 */
export function VideoTestimonialPlayer({ testimonial }: { testimonial: VideoTestimonial }) {
  const inlineRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const video = inlineRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !open) {
          video.preload = "auto";
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play ${testimonial.name}'s video review with sound`}
        className="group relative mx-auto block aspect-[9/16] w-[70%] max-w-[300px] overflow-hidden rounded-3xl bg-navy-950 shadow-[0_24px_60px_-24px_rgba(30,27,75,0.6)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-gold-500 md:w-full"
      >
        <video
          ref={inlineRef}
          src={testimonial.videoUrl}
          poster={testimonial.posterUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-navy-950/90 to-transparent" />
        <span className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2 text-left text-white">
          <span>
            <span className="block text-sm font-semibold">
              {testimonial.name} · {testimonial.location}
            </span>
            <span className="block text-xs text-white/80">
              {testimonial.occasion} · {testimonial.durationLabel}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy-950 transition group-hover:bg-gold-500 group-hover:text-white">
            <Volume2 size={14} aria-hidden="true" /> Sound on
          </span>
        </span>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-navy-950">
            <Play size={26} fill="currentColor" aria-hidden="true" />
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${testimonial.name}'s video review`}
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-navy-950/90 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close video"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy-950"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <video
            src={testimonial.videoUrl}
            poster={testimonial.posterUrl}
            controls
            autoPlay
            playsInline
            className="aspect-[9/16] max-h-[88vh] w-auto max-w-full rounded-2xl bg-black"
          />
        </div>
      ) : null}
    </>
  );
}
