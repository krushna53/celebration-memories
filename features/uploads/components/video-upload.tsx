"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Pause, Play, RotateCcw, Square, SwitchCamera, UploadCloud, Video, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { useMediaUpload } from "@/hooks/use-media-upload";
import { useMediaRecorder, type ZoomRange } from "@/hooks/use-media-recorder";
import { UploadQueue } from "@/features/uploads/components/upload-queue";

interface VideoUploadProps {
  /** Owned by the parent (MediaUploadsSection) — see PhotoUpload's doc comment for why. */
  upload: ReturnType<typeof useMediaUpload>;
  /** Which mode to land in immediately — set to "record" so tapping the Record Video icon in MediaUploadsSection's menu skips straight to the camera view instead of requiring a second tap. Defaults to "upload". The toggle below still lets the guest switch either way after landing. */
  initialMode?: "upload" | "record";
  /** Passed straight through to UploadQueue — see its doc comment. */
  showCaption?: boolean;
  /** Notified whenever isRecording changes — lets MediaUploadsSection's back-button guard catch a guest leaving mid-recording, before there's even a queued item to warn about. */
  onRecordingChange?: (isRecording: boolean) => void;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Picks which zoom pill buttons to show from the camera's actual
 * reported range — never hardcoded 0.5x/1x/2x, since most devices that
 * support zoom at all only report a "zoom in" range starting at 1x (no
 * zoom-out/ultra-wide switch available through the web camera API), and
 * the real max varies by device. Always includes 1x when it's in range
 * so there's a clear "back to normal" option.
 */
function getZoomPresets(range: ZoomRange): number[] {
  const candidates = [0.5, 1, 1.5, 2, 3, 4, 5];
  const inRange = candidates.filter((v) => v >= range.min && v <= range.max);
  if (range.min <= 1 && range.max >= 1 && !inRange.includes(1)) inRange.push(1);
  if (inRange.length === 0) inRange.push(range.min);
  return Array.from(new Set(inRange)).sort((a, b) => a - b);
}

/**
 * Video upload — an existing file, or record directly from the browser.
 * The "record" mode takes over the full screen (fixed inset-0, like a
 * native camera app) rather than sitting in a small boxed-in preview —
 * a phone screen is too small for a postage-stamp-sized viewfinder to
 * be usable. Pause/Cancel/Stop sit in a control bar BELOW the video
 * (not overlaid on top of it), so they never obscure the shot and are
 * always easy to find regardless of what's on screen.
 */
export function VideoUpload({
  upload,
  initialMode = "upload",
  showCaption = true,
  onRecordingChange,
}: VideoUploadProps) {
  const { items, addFiles, setCaption, remove, uploadAll } = upload;
  const [mode, setMode] = useState<"upload" | "record">(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  // Tracks the item just added by a recording so "Record again" can
  // discard exactly that take, without touching anything the guest
  // separately picked from the file library.
  const [lastRecordedId, setLastRecordedId] = useState<string | null>(null);

  const {
    isRecording,
    isPaused,
    seconds,
    previewStream,
    error,
    zoomRange,
    zoomLevel,
    setZoom,
    facingMode,
    flipCamera,
    openPreview,
    closePreview,
    start,
    stop,
    cancel,
    pause,
    resume,
  } = useMediaRecorder({
    kind: "video",
    onCapture: (file) => {
      const [id] = addFiles([file]);
      setLastRecordedId(id ?? null);
    },
  });

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Reports live recording state up to MediaUploadsSection so its
  // back-button guard can catch a guest leaving mid-recording — before
  // stop() has even run, there's no queued item yet to warn about
  // otherwise. Reports false on unmount so the guard doesn't stay
  // latched on if this view goes away some other way.
  useEffect(() => {
    onRecordingChange?.(isRecording);
    return () => onRecordingChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // Opens the camera as soon as the guest lands on the record view —
  // shows a live preview with "Start Recording" below it, like a camera
  // app's viewfinder, instead of a static placeholder until recording
  // has already begun. Releases the camera again on the way out
  // (switching to "Upload a video" or leaving this screen entirely).
  useEffect(() => {
    if (mode === "record") {
      openPreview();
    }
    return () => {
      closePreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Requests real browser fullscreen (hides the address bar too, not
  // just our own fixed-inset-0 overlay) — same try/catch-and-ignore
  // pattern as features/display/big-screen-slideshow.tsx. Support
  // varies: solid on desktop Chrome/Edge/Firefox and Android Chrome;
  // iOS Safari has had it since 16.4 but still reports only partial/
  // flaky support even in current versions, so this is a progressive
  // enhancement, never a requirement — the guest still gets today's
  // full-viewport camera view (mode === "record"'s fixed inset-0) on
  // any browser that can't or won't grant it.
  useEffect(() => {
    if (mode !== "record") return;
    fullscreenContainerRef.current?.requestFullscreen?.().catch(() => {
      // Fullscreen isn't available in every environment (e.g. some iOS
      // browsers, or if it wasn't triggered close enough to the tap
      // that opened this view) — the camera view still works fine
      // without it, just with the browser's own address bar visible.
    });
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [mode]);

  // Locks page scroll while the fullscreen camera view is open, same as
  // any other fullscreen overlay (modal, lightbox) in the app.
  useEffect(() => {
    if (mode !== "record") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

  function recordAgain() {
    if (lastRecordedId) remove(lastRecordedId);
    setLastRecordedId(null);
    start();
  }

  // Backing out while actively recording used to discard the take
  // (cancel()) — a senior guest who taps the close button instead of
  // hunting for a separate "Stop" button would silently lose what
  // they'd just recorded. Finalizing instead (stop()) means closing out
  // of the camera view always keeps whatever was captured so far; the
  // clip lands in the queue below automatically via onCapture, same as
  // a normal Stop tap. Explicit "I don't want this" is still available
  // via the in-recording Cancel button.
  function exitFullscreen() {
    if (isRecording) stop();
    else setMode("upload");
  }

  if (mode === "record") {
    return (
      <div
        ref={fullscreenContainerRef}
        className="fixed inset-0 z-50 flex flex-col bg-navy-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={exitFullscreen}
            aria-label="Close"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full border border-ivory-100/20 text-ivory-100/80 transition-luxury duration-200 hover:border-ivory-100/40"
          >
            <X size={18} />
          </button>
          <h3 className="font-display text-sm text-ivory-50">Record a Video</h3>
          {previewStream && !isRecording ? (
            <button
              type="button"
              onClick={flipCamera}
              title="Switch Camera"
              aria-label="Switch Camera"
              className="tap-target flex h-9 w-9 items-center justify-center rounded-full border border-ivory-100/20 text-ivory-100/80 transition-luxury duration-200 hover:border-ivory-100/40"
            >
              <SwitchCamera size={17} />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          {previewStream ? (
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              // Mirror the front-camera preview only — matches every
              // native camera app (a selfie feels wrong unmirrored,
              // like moving a hand and watching it go the "wrong" way).
              // This is purely a display flip: the underlying stream
              // recorded by MediaRecorder is untouched, so the saved
              // video comes out the same way everyone else sees the
              // guest, same as Instagram/Snapchat/iOS Camera.
              className={cn("h-full w-full object-cover", facingMode === "user" && "-scale-x-100")}
            />
          ) : error ? (
            <div className="flex h-full w-full items-center justify-center text-ivory-100/40">
              <Video size={40} />
            </div>
          ) : (
            // The camera can take a moment to warm up (permission
            // prompt, hardware negotiation) before any picture shows up
            // — an unlabeled spinner in that gap reads as "is this
            // broken?" on a slower phone. A gentle pulsing ring around a
            // camera icon, plus a plain-language "hang tight" line,
            // makes clear this is expected and momentary.
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-gold-500/20" />
                <span className="absolute inset-2 animate-ping rounded-full bg-gold-500/25 [animation-delay:300ms]" />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
                  <Video size={24} />
                </span>
              </div>
              <div>
                <p className="font-display text-sm text-ivory-50">Turning on your camera&hellip;</p>
                <p className="mt-1 text-xs text-ivory-100/50">Hang tight — you&rsquo;ll see yourself in a moment.</p>
              </div>
            </div>
          )}

          {isRecording ? (
            <p className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 font-display text-sm text-gold-300 tabular-nums">
              <span className={cn("h-2 w-2 rounded-full bg-red-500", !isPaused && "animate-pulse")} />
              {formatSeconds(seconds)}
              {isPaused ? <span className="text-[10px] uppercase tracking-wide text-ivory-100/70">Paused</span> : null}
            </p>
          ) : lastRecordedId ? (
            <p className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 font-display text-sm text-green-400 tabular-nums">
              <CheckCircle2 size={14} />
              Captured &middot; {formatSeconds(seconds)}
            </p>
          ) : null}

          {/*
            Real hardware zoom — only rendered where the camera/browser
            actually reports a zoom range (zoomRange is null everywhere
            else, notably every iOS Safari, since WebKit doesn't expose
            camera zoom to the web at all). Deliberately no fallback
            "fake" zoom control for unsupported devices — a zoom button
            that silently does nothing is worse than no button.
          */}
          {previewStream && zoomRange ? (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 p-1">
              {getZoomPresets(zoomRange).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setZoom(preset)}
                  className={cn(
                    "tap-target rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-luxury duration-150",
                    Math.abs(zoomLevel - preset) < 0.05
                      ? "bg-gold-500 text-navy-950"
                      : "text-ivory-100/80 hover:text-ivory-50",
                  )}
                >
                  {preset % 1 === 0 ? preset : preset.toFixed(1)}x
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 px-4 pb-5 pt-4">
          {/*
            Once a take exists, "Done — Review & Upload" becomes the
            PRIMARY action (the big gold pill) instead of a small,
            easy-to-miss text link below a still-prominent "Start
            Recording" button — a guest who just finished recording is
            almost always trying to move on, not re-record, and the old
            layout buried that action next to equal-weight "Record
            again" text. "Record Again" is still one tap away, just
            visually secondary now.
          */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isRecording ? (
              <>
                <button
                  type="button"
                  onClick={isPaused ? resume : pause}
                  className="tap-target flex items-center gap-2 rounded-full border border-ivory-100/30 bg-navy-900 px-4 py-3 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:border-ivory-100/50"
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="tap-target flex items-center gap-2 rounded-full border border-ivory-100/30 bg-navy-900 px-4 py-3 text-sm font-medium text-ivory-100/80 transition-luxury duration-200 hover:border-red-400/50 hover:text-red-300"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="tap-target flex items-center gap-2 rounded-full bg-red-600 px-7 py-3 text-sm font-medium text-white shadow-lg transition-luxury duration-200"
                >
                  <Square size={16} />
                  Stop
                </button>
              </>
            ) : lastRecordedId ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className="tap-target flex items-center gap-2 rounded-full bg-gold-500 px-7 py-3 text-sm font-medium text-navy-950 shadow-lg transition-luxury duration-200"
                >
                  <CheckCircle2 size={18} />
                  Done — Review &amp; Upload
                </button>
                <button
                  type="button"
                  onClick={recordAgain}
                  className="tap-target flex items-center gap-2 rounded-full border border-ivory-100/30 bg-navy-900 px-4 py-3 text-sm font-medium text-ivory-100/80 transition-luxury duration-200 hover:border-ivory-100/50"
                >
                  <RotateCcw size={16} />
                  Record Again
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={start}
                disabled={!previewStream}
                title="Start Recording"
                aria-label="Start Recording"
                className="tap-target group flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-ivory-100/90 shadow-lg transition-luxury duration-200 active:scale-95 disabled:opacity-40"
              >
                <span className="h-[54px] w-[54px] rounded-full bg-red-600 transition-luxury duration-200" />
              </button>
            )}
          </div>

          {/* "Start Recording" is a tooltip (title attribute above) now
              instead of visible text — a plain red-circle-in-a-ring is
              the near-universal record-button shape on both iOS and
              Android camera apps, so a single icon design reads
              correctly on either platform without needing OS detection. */}
          {!isRecording && !lastRecordedId ? (
            <p className="mt-3 text-center text-xs text-ivory-100/50">Tap to start recording</p>
          ) : null}

          {error ? <p className="mt-3 text-center text-xs text-red-400">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn(
            "flex-1 rounded-lg border px-4 py-2 text-sm transition-luxury duration-200",
            "border-gold-500 bg-gold-500/10 text-navy-950 font-medium",
          )}
        >
          Upload a video
        </button>
        <button
          type="button"
          onClick={() => setMode("record")}
          className={cn(
            "flex-1 rounded-lg border px-4 py-2 text-sm transition-luxury duration-200",
            "border-navy-950/15 text-navy-700/70",
          )}
        >
          Record instead
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-500/30 bg-gold-500/5 px-4 py-8 text-center transition-luxury duration-200 hover:border-gold-500/60 hover:bg-gold-500/10"
      >
        <UploadCloud className="text-gold-500" size={28} />
        <span className="text-sm font-medium text-navy-950">Tap to choose a video</span>
        <span className="text-xs text-navy-700/60">MP4 or MOV · up to 1GB</span>
      </button>

      <button
        type="button"
        onClick={() => setMode("record")}
        className="tap-target mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-gold-600 hover:text-gold-700"
      >
        <Video size={13} />
        Or record a video with your camera instead
      </button>

      <UploadQueue
        items={items}
        onCaptionChange={setCaption}
        onRemove={(id) => {
          if (id === lastRecordedId) setLastRecordedId(null);
          remove(id);
        }}
        onUploadAll={uploadAll}
        showCaption={showCaption}
        onRecordAgain={(id) => {
          if (id === lastRecordedId) setLastRecordedId(null);
          remove(id);
          setMode("record");
        }}
      />
    </div>
  );
}
