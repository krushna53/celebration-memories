"use client";

import { useCallback, useRef, useState } from "react";

export interface SlideshowPhotoInput {
  id: string;
  url: string;
}

interface UseSlideshowRecorderOptions {
  /** Output frame size — 1280x720 keeps file size reasonable while staying widescreen-shareable. */
  width?: number;
  height?: number;
}

export type SlideshowStatus = "idle" | "loading" | "recording" | "done" | "error";

/**
 * Renders a sequence of photos onto a <canvas> (with a simple crossfade
 * + slow Ken Burns zoom between each), optionally mixes in an audio
 * track, and records the result via captureStream() + MediaRecorder —
 * entirely in the browser. No server involved at all, so there's no
 * Netlify function timeout to worry about (see lib/ai-image.ts for the
 * server-side equivalent problem this deliberately avoids).
 *
 * Photos must be served with permissive CORS (true for Supabase Storage
 * public buckets) since a canvas fed with cross-origin images without
 * CORS gets "tainted" and captureStream() silently produces blank frames.
 */
export function useSlideshowRecorder({ width = 1280, height = 720 }: UseSlideshowRecorderOptions = {}) {
  const [status, setStatus] = useState<SlideshowStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const stopRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const generate = useCallback(
    async (photos: SlideshowPhotoInput[], secondsPerPhoto: number, audioFile: File | null) => {
      if (photos.length === 0) {
        setError("Pick at least one photo.");
        setStatus("error");
        return;
      }

      setStatus("loading");
      setError(null);
      setProgress(0);
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        // Preload every image up front so playback doesn't stall mid-recording.
        const images = await Promise.all(
          photos.map(
            (p) =>
              new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Could not load photo: ${p.url}`));
                img.src = p.url;
              }),
          ),
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas isn't supported in this browser.");

        const canvasStream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30);
        const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

        let audioEl: HTMLAudioElement | null = null;
        let audioCtx: AudioContext | null = null;
        let audioObjectUrl: string | null = null;

        if (audioFile) {
          audioObjectUrl = URL.createObjectURL(audioFile);
          audioEl = new Audio(audioObjectUrl);
          audioEl.loop = false;
          const AudioContextCtor =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AudioContextCtor();
          const source = audioCtx.createMediaElementSource(audioEl);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          tracks.push(...dest.stream.getAudioTracks());
        }

        const combinedStream = new MediaStream(tracks);

        const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
        const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

        const recorder = new MediaRecorder(combinedStream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const totalDurationMs = images.length * secondsPerPhoto * 1000;
        const crossfadeMs = Math.min(700, secondsPerPhoto * 500);

        const finished = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            setVideoUrl(URL.createObjectURL(blob));
            resolve();
          };
        });

        let rafId: number | null = null;
        let stopped = false;

        function stopAll() {
          if (stopped) return;
          stopped = true;
          if (rafId !== null) cancelAnimationFrame(rafId);
          if (recorder.state !== "inactive") recorder.stop();
          combinedStream.getTracks().forEach((t) => t.stop());
          audioEl?.pause();
          if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
          audioCtx?.close().catch(() => {});
        }
        stopRef.current = stopAll;

        function drawFrame(img: HTMLImageElement, alpha: number, zoom: number) {
          const scale = Math.max(width / img.width, height / img.height) * zoom;
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = (width - drawW) / 2;
          const dy = (height - drawH) / 2;
          ctx!.globalAlpha = alpha;
          ctx!.drawImage(img, dx, dy, drawW, drawH);
        }

        setStatus("recording");
        recorder.start(250);
        audioEl?.play().catch(() => {
          /* Autoplay may be blocked without a prior user gesture on some browsers; recording continues silently. */
        });

        const startTime = performance.now();

        function tick(now: number) {
          const elapsed = now - startTime;
          setProgress(Math.min(1, elapsed / totalDurationMs));

          if (elapsed >= totalDurationMs) {
            stopAll();
            return;
          }

          const index = Math.min(images.length - 1, Math.floor(elapsed / (secondsPerPhoto * 1000)));
          const withinPhoto = elapsed - index * secondsPerPhoto * 1000;
          const zoom = 1 + 0.08 * (withinPhoto / (secondsPerPhoto * 1000));

          ctx!.clearRect(0, 0, width, height);
          ctx!.fillStyle = "#0b1220";
          ctx!.fillRect(0, 0, width, height);

          drawFrame(images[index]!, 1, zoom);

          // Crossfade into the next photo near the end of this one's slot.
          if (index < images.length - 1 && withinPhoto > secondsPerPhoto * 1000 - crossfadeMs) {
            const fadeProgress = (withinPhoto - (secondsPerPhoto * 1000 - crossfadeMs)) / crossfadeMs;
            drawFrame(images[index + 1]!, fadeProgress, 1);
          }

          rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);

        await finished;
        setStatus("done");
        setProgress(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong generating the video.");
        setStatus("error");
      }
    },
    [width, height],
  );

  const cancel = useCallback(() => {
    stopRef.current?.();
  }, []);

  return { status, progress, error, videoUrl, generate, cancel, reset };
}
