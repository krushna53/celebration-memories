"use client";

import { useCallback, useRef, useState } from "react";

interface UseMediaRecorderOptions {
  /** "audio" records mic only; "video" records camera + mic. */
  kind: "audio" | "video";
  onCapture: (file: File) => void;
}

/** { min, max, step } from the video track's own reported zoom range — never hardcoded, since it comes straight from whatever the connected camera hardware/driver actually supports. */
export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

/**
 * Thin wrapper around the browser MediaRecorder API for the "or record
 * directly from the browser" upload option (audio + video). Produces a
 * plain File on stop, which callers feed into the same upload pipeline
 * used for picked files — recording is just an alternate file source.
 *
 * Supports pause/resume (MediaRecorder.pause()/resume(), feature-
 * detected — most browsers support it, but this degrades quietly rather
 * than throwing if one doesn't) and cancel (stop without keeping the
 * clip, for "I don't want this take" — distinct from stop(), which
 * always finalizes and hands the recording to onCapture).
 *
 * openPreview()/closePreview() let a caller (video-upload.tsx) turn the
 * camera on for a live look before actually recording — start() reuses
 * that already-open stream if one exists rather than requesting
 * getUserMedia a second time, so tapping "Start Recording" after a
 * preview is instant instead of prompting for camera access twice.
 *
 * For "video", also exposes camera zoom (zoomRange/zoomLevel/setZoom)
 * where the browser/hardware supports it — real hardware zoom via the
 * non-standard MediaTrackConstraints `zoom` capability, Chromium-only
 * (desktop Chrome/Edge, Android Chrome). iOS Safari never implements
 * this — WebKit doesn't expose zoom to the web at all, and every
 * browser on iOS is required to use WebKit, so there's no browser
 * choice that fixes it there. zoomRange is null wherever unsupported;
 * callers should hide zoom controls entirely in that case rather than
 * show a control that silently does nothing.
 *
 * Also exposes facingMode/flipCamera to switch between front and back
 * camera — standard across every browser (unlike zoom), but only
 * allowed while not actively recording; see flipCamera's own doc
 * comment for why.
 */
/** getUserMedia's video constraint — a plain `{ facingMode }` object (not wrapped in `ideal`/`exact`) so a device that only has one camera still resolves fine rather than rejecting a constraint it can't satisfy exactly. */
function buildConstraints(kind: "audio" | "video", facingMode: "user" | "environment"): MediaStreamConstraints {
  return kind === "video" ? { video: { facingMode }, audio: true } : { audio: true };
}

export function useMediaRecorder({ kind, onCapture }: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = "not supported on this device/browser" (e.g. every iOS
  // Safari — see hooks/use-media-recorder.ts's module doc comment).
  // Only ever populated for kind: "video".
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  // "user" (front/selfie) is the sensible default for a "record a video
  // message" feature — most guests are talking to the camera, not
  // filming something else. Only meaningful for kind: "video".
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Set right before calling recorder.stop() from cancel() — checked in
  // the onstop handler so a cancelled take never reaches onCapture.
  const discardRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  /** Reads the connected camera's real zoom range off its video track, if the browser/hardware exposes one at all — see the module doc comment above for which browsers that is. */
  const detectZoomRange = useCallback((stream: MediaStream) => {
    if (kind !== "video") return;
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== "function") {
      setZoomRange(null);
      return;
    }
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min: number; max: number; step: number };
    };
    if (capabilities.zoom) {
      setZoomRange(capabilities.zoom);
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
      setZoomLevel(settings.zoom ?? 1);
    } else {
      setZoomRange(null);
    }
  }, [kind]);

  /** No-ops quietly if zoom isn't supported (zoomRange null) or the value is out of range — callers gate the UI on zoomRange already, this is just a second safety net. */
  const setZoom = useCallback(async (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) return;
    const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, value));
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] });
      setZoomLevel(clamped);
    } catch (err) {
      console.error("Failed to apply zoom constraint:", err);
    }
  }, [zoomRange]);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewStream(null);
    setZoomRange(null);
    setZoomLevel(1);
    setFacingMode("user");
  }, []);

  /** Opens the camera/mic and shows a live preview without recording yet. Safe to call more than once — a no-op if a stream is already open. */
  const openPreview = useCallback(async () => {
    if (streamRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(kind, facingMode));
      streamRef.current = stream;
      setPreviewStream(stream);
      detectZoomRange(stream);
    } catch {
      setError(
        kind === "video"
          ? "Camera/microphone access was denied or unavailable."
          : "Microphone access was denied or unavailable.",
      );
    }
  }, [kind, facingMode, detectZoomRange]);

  /**
   * Switches between front and back camera — only while not actively
   * recording. MediaRecorder is bound to the specific MediaStream/track
   * it was created with; swapping the video track underneath a live
   * recorder is unreliable across browsers (some drop video entirely,
   * some just ignore the swap), so this tears down and reopens the
   * whole stream instead, which only makes sense between takes, not
   * mid-take. Callers should hide/disable the flip control whenever
   * isRecording is true.
   */
  const flipCamera = useCallback(async () => {
    if (kind !== "video" || isRecording) return;
    const next: "user" | "environment" = facingMode === "user" ? "environment" : "user";
    setError(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia(buildConstraints("video", next));
      // Only stop the old stream once the new one is confirmed working —
      // avoids a "camera unavailable" flash if the swap fails partway.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = newStream;
      setFacingMode(next);
      setPreviewStream(newStream);
      detectZoomRange(newStream);
    } catch {
      setError("Could not switch cameras.");
    }
  }, [kind, isRecording, facingMode, detectZoomRange]);

  /** Releases the camera/mic without recording anything — for leaving record mode after only previewing. Never tears down mid-recording. */
  const closePreview = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    teardownStream();
  }, [teardownStream]);

  const start = useCallback(async () => {
    setError(null);
    try {
      // Reuse the already-open preview stream if openPreview() got there
      // first — avoids a second getUserMedia prompt/negotiation.
      const reusedExisting = Boolean(streamRef.current);
      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia(buildConstraints(kind, facingMode)));
      streamRef.current = stream;
      setPreviewStream(stream);
      if (!reusedExisting) detectZoomRange(stream);
      chunksRef.current = [];
      discardRef.current = false;

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (!discardRef.current) {
          // recorder.mimeType often comes back with codec parameters, e.g.
          // "video/webm;codecs=vp8,opus" or "audio/webm;codecs=opus" — the
          // upload pipeline's accepted-type list (types/memory.ts) and the
          // Storage bucket's own MIME allowlist both check the exact
          // Content-Type, so a codec suffix neither one knows about would
          // otherwise get rejected as "unsupported file type" even for an
          // accepted base type. Stripping down to the base type here —
          // not just at the validation call site — means the File's own
          // .type always matches exactly what's allowed, all the way
          // through Storage.
          const rawMimeType = recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm");
          const mimeType = (rawMimeType.split(";")[0] ?? rawMimeType).trim();
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const file = new File([blob], `${kind}-recording-${Date.now()}.${ext}`, {
            type: mimeType,
          });
          onCapture(file);
        }
        chunksRef.current = [];
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setSeconds(0);
      clearTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(
        kind === "video"
          ? "Camera/microphone access was denied or unavailable."
          : "Microphone access was denied or unavailable.",
      );
    }
  }, [kind, facingMode, onCapture, detectZoomRange]);

  /**
   * Finalizes the recording and hands it to onCapture. Deliberately
   * leaves the camera/mic preview running afterward (like a real camera
   * app's viewfinder) so "Record again" doesn't need to re-request
   * permission or renegotiate the stream — closePreview() is the only
   * thing that actually releases the camera.
   */
  const stop = useCallback(() => {
    discardRef.current = false;
    recorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
    clearTimer();
  }, []);

  /** Ends the recording WITHOUT keeping it — for "never mind, discard this take." Also leaves the preview running, same reasoning as stop(). */
  const cancel = useCallback(() => {
    discardRef.current = true;
    recorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
    setSeconds(0);
    clearTimer();
  }, []);

  /** Feature-detected — pause()/resume() aren't guaranteed on every browser MediaRecorder implementation, so this quietly no-ops rather than throwing on one that lacks it. */
  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || typeof recorder.pause !== "function" || recorder.state !== "recording") return;
    recorder.pause();
    setIsPaused(true);
    clearTimer();
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || typeof recorder.resume !== "function" || recorder.state !== "paused") return;
    recorder.resume();
    setIsPaused(false);
    clearTimer();
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  return {
    isRecording,
    isPaused,
    seconds,
    previewStream,
    error,
    /** null on any device/browser that doesn't expose camera zoom (every iOS Safari, most non-Chromium browsers) — callers should hide zoom UI entirely rather than show a control that does nothing. */
    zoomRange,
    zoomLevel,
    setZoom,
    /** "user" (front) or "environment" (back) — only meaningful for kind: "video". */
    facingMode,
    flipCamera,
    openPreview,
    closePreview,
    start,
    stop,
    cancel,
    pause,
    resume,
  };
}
