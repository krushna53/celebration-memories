"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, Film, Loader2, Music, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSlideshowRecorder, type SlideshowPhotoInput } from "@/hooks/use-slideshow-recorder";
import type { SlideSource } from "@/types/content";

interface SlideshowComposerProps {
  slides: SlideSource[];
}

export function SlideshowComposer({ slides }: SlideshowComposerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(slides.slice(0, 8).map((p) => p.id));
  const [secondsPerPhoto, setSecondsPerPhoto] = useState(3);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { status, progress, error, videoUrl, generate, cancel, reset } = useSlideshowRecorder();

  const selectedPhotos: SlideshowPhotoInput[] = selectedIds
    .map((id) => slides.find((p) => p.id === id))
    .filter((p): p is SlideSource => Boolean(p))
    .map((p) => ({ id: p.id, url: p.url }));

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id);
      const next = index + dir;
      if (index === -1 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next]!, copy[index]!];
      return copy;
    });
  }

  const busy = status === "loading" || status === "recording";

  if (slides.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-navy-950/15 bg-white p-8 text-center">
        <Film className="mx-auto text-navy-700/30" size={28} />
        <h3 className="mt-3 font-display text-lg text-navy-950">No photos yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-700/60">
          Add some photos in Gallery, or attach a photo to a Timeline milestone, then come
          back here to turn them into a slideshow video.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-5">
        <section className="rounded-xl border border-navy-950/10 bg-white p-4">
          <h2 className="font-display text-lg text-navy-950">1. Pick &amp; order photos</h2>
          <p className="mt-1 text-xs text-navy-700/50">
            {selectedIds.length} of {slides.length} selected — reorder with the arrows.
          </p>
          <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
            {selectedIds.map((id, i) => {
              const photo = slides.find((p) => p.id === id);
              if (!photo) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-lg border border-navy-950/10 bg-navy-950/[0.02] p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption ?? ""} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                  <div className="flex-1 truncate text-xs text-navy-700/70">{photo.caption ?? "Untitled"}</div>
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-navy-700/50 hover:bg-navy-950/5 disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    disabled={i === selectedIds.length - 1}
                    className="rounded p-1 text-navy-700/50 hover:bg-navy-950/5 disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="rounded p-1 text-navy-700/50 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-navy-950/5 pt-3">
            {slides
              .filter((p) => !selectedIds.includes(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="relative"
                  title="Add to slideshow"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? ""} className="h-12 w-12 rounded-md object-cover opacity-50 hover:opacity-100" />
                </button>
              ))}
          </div>
        </section>

        <section className="rounded-xl border border-navy-950/10 bg-white p-4">
          <h2 className="font-display text-lg text-navy-950">2. Timing &amp; music</h2>
          <div className="mt-3 grid gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
                Seconds per photo
              </label>
              <input
                type="range"
                min={1.5}
                max={6}
                step={0.5}
                value={secondsPerPhoto}
                onChange={(e) => setSecondsPerPhoto(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <p className="text-xs text-navy-700/50">
                {secondsPerPhoto}s each · total ~{Math.round(selectedIds.length * secondsPerPhoto)}s
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
                Background music (optional)
              </label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-m4a"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              />
              {audioFile ? (
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-navy-950/10 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 truncate text-navy-950">
                    <Music size={14} /> {audioFile.name}
                  </span>
                  <button type="button" onClick={() => setAudioFile(null)} className="text-navy-700/50 hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={() => audioInputRef.current?.click()}>
                  <Music size={14} /> Add audio track
                </Button>
              )}
              <p className="mt-1.5 text-xs text-navy-700/50">
                Only use music you have the rights to use — this doesn&rsquo;t check licensing for you.
              </p>
            </div>
          </div>
        </section>

        <Button
          size="lg"
          disabled={busy || selectedIds.length === 0}
          onClick={() => generate(selectedPhotos, secondsPerPhoto, audioFile)}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              {status === "loading" ? "Loading photos..." : `Recording... ${Math.round(progress * 100)}%`}
            </>
          ) : (
            <>
              <Film size={16} /> Generate Video
            </>
          )}
        </Button>
        {busy ? (
          <button type="button" onClick={cancel} className="text-left text-xs text-navy-700/50 underline underline-offset-2">
            Cancel
          </button>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div>
        <section className="sticky top-6 rounded-xl border border-navy-950/10 bg-white p-4">
          <h2 className="font-display text-lg text-navy-950">Preview</h2>
          <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-navy-950">
            {videoUrl ? (
              <video src={videoUrl} controls className="h-full w-full object-contain" />
            ) : (
              <p className="px-4 text-center text-sm text-white/40">
                {busy ? "Rendering..." : "Your video will appear here once generated."}
              </p>
            )}
          </div>
          {videoUrl ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={videoUrl} download="slideshow.webm">
                  <Download size={14} /> Download
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                Start over
              </Button>
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-navy-700/50">
            Rendered entirely in your browser — nothing is uploaded until you
            choose to save or share the downloaded file yourself (e.g. as a
            WhatsApp status, or upload it wherever you&rsquo;d like).
          </p>
        </section>
      </div>
    </div>
  );
}
