"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Download, Film, ImagePlus, Loader2, Music, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSlideshowVideoJob } from "@/hooks/use-slideshow-video-job";
import { requestSlideshowMusicUploadUrlAction } from "@/features/admin/slideshow/actions";
import { confirmShareVideoUploadAction } from "@/features/admin/event-settings/actions";
import type { SlideSource } from "@/types/content";

interface SlideshowComposerProps {
  eventId: string;
  slides: SlideSource[];
  /** Non-null only for client-role admins — owner has no cap. */
  quota: { used: number; limit: number } | null;
  theme: { primaryColor: string; secondaryColor: string; fontFamily: string };
}

const STATUS_LABEL: Record<string, string> = {
  starting: "Starting...",
  processing: "Rendering — this can take a minute or two...",
};

export function SlideshowComposer({ eventId, slides, quota, theme }: SlideshowComposerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(slides.slice(0, 8).map((p) => p.id));
  const [secondsPerPhoto, setSecondsPerPhoto] = useState(3);
  const [showCaptions, setShowCaptions] = useState(true);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [savedAsPreview, setSavedAsPreview] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { status, error, videoUrl, remaining, generate, cancel, reset } = useSlideshowVideoJob();

  const selectedSlides = selectedIds
    .map((id) => slides.find((p) => p.id === id))
    .filter((p): p is SlideSource => Boolean(p));

  // remaining comes from the hook once a render has actually been
  // started (the Server Action computes it at job-creation time — same
  // optimistic-decrement convention AI Image uses); falls back to the
  // page's server-rendered quota beforehand.
  const remainingCount = remaining ?? (quota ? quota.limit - quota.used : null);
  const atLimit = remainingCount !== null && remainingCount <= 0;

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

  async function handleAudioPick(file: File | null) {
    setAudioError(null);
    setAudioFile(file);
  }

  async function handleGenerate() {
    setSavedAsPreview(false);

    let audioUrl: string | null = null;
    if (audioFile) {
      setAudioUploading(true);
      setAudioError(null);
      try {
        const signed = await requestSlideshowMusicUploadUrlAction(
          eventId,
          audioFile.name,
          audioFile.type,
          audioFile.size,
        );
        if (!signed.success) throw new Error(signed.error);

        const { bucket, path, token } = signed.data;
        const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, audioFile);
        if (uploadError) throw new Error(uploadError.message);

        audioUrl = supabaseBrowser().storage.from(bucket).getPublicUrl(path).data.publicUrl;
      } catch (err) {
        setAudioUploading(false);
        setAudioError(err instanceof Error ? err.message : "Failed to upload audio.");
        return;
      }
      setAudioUploading(false);
    }

    await generate({
      eventId,
      slides: selectedSlides.map((s) => ({
        url: s.url,
        captionTitle: s.captionTitle,
        captionSubtitle: s.captionSubtitle,
      })),
      secondsPerPhoto,
      audioUrl,
      showCaptions,
      theme,
    });
  }

  async function handleUseAsShareVideo(path: string) {
    setAudioError(null);
    // The Link Preview Video is fetched synchronously by crawlers with
    // tight timeouts (see createSignedShareVideoUpload's doc comment) —
    // that 20MB ceiling is only enforced on the browser-upload path, so
    // check it here too before saving a render that came from this
    // longer-video-capable flow instead.
    if (videoUrl) {
      try {
        const head = await fetch(videoUrl, { method: "HEAD" });
        const size = Number(head.headers.get("content-length") || 0);
        if (size > 20 * 1024 * 1024) {
          setAudioError(
            "This video is over 20MB, too large for a reliable Link Preview Video — try fewer photos or fewer seconds per photo.",
          );
          return;
        }
      } catch {
        // If the size check itself fails, fall through and let the save proceed.
      }
    }
    const outcome = await confirmShareVideoUploadAction(eventId, path);
    if (outcome.success) {
      setSavedAsPreview(true);
    } else {
      setAudioError(outcome.error);
    }
  }

  const busy = status === "starting" || status === "processing" || audioUploading;
  const resultPath = videoUrl ? new URL(videoUrl).pathname.split("/gallery/")[1] ?? null : null;

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
          <h2 className="font-display text-lg text-navy-950">2. Timing, captions &amp; music</h2>
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
            <label className="flex items-center gap-2 text-sm text-navy-950">
              <input
                type="checkbox"
                checked={showCaptions}
                onChange={(e) => setShowCaptions(e.target.checked)}
                className="h-4 w-4 rounded border-navy-950/20"
              />
              Show captions on Timeline slides
            </label>
            <p className="-mt-2 text-xs text-navy-700/50">
              Adds a caption bar with the milestone&rsquo;s title and period (or a Gallery
              photo&rsquo;s caption) at the bottom of that slide, styled with your event&rsquo;s
              theme colors.
            </p>
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
                Background music (optional)
              </label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/webm"
                className="hidden"
                onChange={(e) => handleAudioPick(e.target.files?.[0] ?? null)}
              />
              {audioFile ? (
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-navy-950/10 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 truncate text-navy-950">
                    <Music size={14} /> {audioFile.name}
                  </span>
                  <button type="button" onClick={() => handleAudioPick(null)} className="text-navy-700/50 hover:text-red-600">
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
                Uploaded to your event&rsquo;s Storage so the render service can use it (25MB limit).
              </p>
              {audioError ? <p className="mt-1 text-xs text-red-600">{audioError}</p> : null}
            </div>
          </div>
        </section>

        <Button
          size="lg"
          disabled={busy || selectedIds.length === 0 || atLimit}
          onClick={handleGenerate}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              {audioUploading ? "Uploading audio..." : STATUS_LABEL[status] ?? "Working..."}
            </>
          ) : (
            <>
              <Film size={16} /> Generate Video
            </>
          )}
        </Button>
        {busy && status === "processing" ? (
          <button type="button" onClick={cancel} className="text-left text-xs text-navy-700/50 underline underline-offset-2">
            Cancel
          </button>
        ) : null}
        {atLimit ? (
          <p className="text-sm text-amber-700">
            You&rsquo;ve used all {quota?.limit} Slideshow Video renders for this event. Contact
            your site admin to raise the limit.
          </p>
        ) : remainingCount !== null ? (
          <p className="text-xs text-navy-700/50">{remainingCount} render{remainingCount === 1 ? "" : "s"} remaining.</p>
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
                <a href={videoUrl} download="slideshow.mp4">
                  <Download size={14} /> Download
                </a>
              </Button>
              {resultPath ? (
                <Button variant="outline" size="sm" onClick={() => handleUseAsShareVideo(resultPath)}>
                  {savedAsPreview ? <Check size={14} /> : <ImagePlus size={14} />}
                  Use as Link Preview Video
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={reset}>
                Start over
              </Button>
            </div>
          ) : null}
          {savedAsPreview ? (
            <p className="mt-2 text-xs text-green-700">Saved as your Link Preview Video.</p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-navy-700/50">
            Rendered server-side as a real <code className="rounded bg-navy-950/5 px-1 py-0.5">.mp4</code> —
            plays everywhere, including as the Event Settings{" "}
            <strong>Link Preview Video</strong> (up to 20MB) with no conversion step needed.
          </p>
        </section>
      </div>
    </div>
  );
}
