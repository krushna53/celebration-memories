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
 * camera, and aspectRatioPreset/setAspectRatio to switch frame shape
 * (9:16/1:1/4:3) — both standard across every browser (unlike zoom),
 * but only allowed while not actively recording; see flipCamera's own
 * doc comment for why.
 */
/** Presets offered in the record view — "9:16" (default, matches the fullscreen portrait camera view) mirrors a phone screen; "1:1" and "4:3" are the other common shapes native camera apps offer. */
export const ASPECT_RATIO_PRESETS = ["9:16", "1:1", "4:3"] as const;
export type AspectRatioPreset = (typeof ASPECT_RATIO_PRESETS)[number];

const ASPECT_RATIO_VALUES: Record<AspectRatioPreset, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
};

/**
 * getUserMedia's video constraint. `facingMode` and `aspectRatio` are
 * both requested as `ideal` (not `exact`) so a device that can't fully
 * satisfy one — a single-camera desktop, or a camera whose sensor
 * doesn't natively do 1:1 — still resolves with its closest match
 * instead of rejecting the whole request.
 */
function buildConstraints(
  kind: "audio" | "video",
  facingMode: "user" | "environment",
  aspectRatioPreset: AspectRatioPreset,
): MediaStreamConstraints {
  return kind === "video"
    ? { video: { facingMode, aspectRatio: { ideal: ASPECT_RATIO_VALUES[aspectRatioPreset] } }, audio: true }
    : { audio: true };
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
  // "9:16" matches the fullscreen portrait camera view guests already
  // see, so it's the sensible default rather than whatever the camera's
  // native/landscape shape happens to be. Only meaningful for "video".
  const [aspectRatioPreset, setAspectRatioPresetState] = useState<AspectRatioPreset>("9:16");

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
    setAspectRatioPresetState("9:16");
  }, []);

  /** Opens the camera/mic and shows a live preview without recording yet. Safe to call more than once — a no-op if a stream is already open. */
  const openPreview = useCallback(async () => {
    if (streamRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(kind, facingMode, aspectRatioPreset));
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
  }, [kind, facingMode, aspectRatioPreset, detectZoomRange]);

  /**
   * Switches the requested frame shape. Unlike flipCamera, this doesn't
   * need to tear down and reopen the stream — aspectRatio is a standard
   * MediaTrackConstraint (unlike zoom/torch), so the existing track can
   * usually just renegotiate it live via applyConstraints(). Only
   * allowed while not recording: no native camera app lets you change
   * the frame shape mid-take either, since it would mean the recording's
   * dimensions change partway through.
   */
  const setAspectRatio = useCallback(async (preset: AspectRatioPreset) => {
    if (kind !== "video" || isRecording) return;
    setAspectRatioPresetState(preset);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ aspectRatio: { ideal: ASPECT_RATIO_VALUES[preset] } });
    } catch (err) {
      console.error("Failed to apply aspect ratio constraint:", err);
    }
  }, [kind, isRecording]);

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
    // Most phone camera stacks — every iOS Safari included — only allow
    // one active camera stream at a time. Requesting the new-facing
    // stream *before* releasing the current one (as this used to do)
    // throws (NotReadableError / "Could not start video source") on
    // those devices instead of returning a second stream, so the flip
    // silently failed there every time. Releasing first means a brief
    // black flash while the new camera negotiates, but that's the only
    // way this actually works across devices.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewStream(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia(buildConstraints("video", next, aspectRatioPreset));
      streamRef.current = newStream;
      setFacingMode(next);
      setPreviewStream(newStream);
      detectZoomRange(newStream);
    } catch {
      // The camera we just released can be briefly unavailable right
      // after being closed — try to get the guest's original camera
      // back rather than leaving them staring at a dead preview with no
      // way to recover except backing out of the recorder entirely.
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia(
          buildConstraints("video", facingMode, aspectRatioPreset),
        );
        streamRef.current = fallbackStream;
        setPreviewStream(fallbackStream);
        detectZoomRange(fallbackStream);
        setError("Could not switch cameras.");
      } catch {
        setError("Camera unavailable — try closing and reopening the recorder.");
      }
    }
  }, [kind, isRecording, facingMode, aspectRatioPreset, detectZoomRange]);

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
      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia(buildConstraints(kind, facingMode, aspectRatioPreset)));
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
  }, [kind, facingMode, aspectRatioPreset, onCapture, detectZoomRange]);

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
    /** Current frame-shape preset — see ASPECT_RATIO_PRESETS. Only meaningful for kind: "video". */
    aspectRatioPreset,
    setAspectRatio,
    openPreview,
    closePreview,
    start,
    stop,
    cancel,
    pause,
    resume,
  };
}
