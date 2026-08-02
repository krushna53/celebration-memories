"use client";

import { useCallback, useRef, useState } from "react";

interface UseMediaRecorderOptions {
  /** "audio" records mic only; "video" records camera + mic. */
  kind: "audio" | "video";
  onCapture: (file: File) => void;
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
 */
export function useMediaRecorder({ kind, onCapture }: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewStream(null);
  }, []);

  /** Opens the camera/mic and shows a live preview without recording yet. Safe to call more than once — a no-op if a stream is already open. */
  const openPreview = useCallback(async () => {
    if (streamRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { video: true, audio: true } : { audio: true },
      );
      streamRef.current = stream;
      setPreviewStream(stream);
    } catch {
      setError(
        kind === "video"
          ? "Camera/microphone access was denied or unavailable."
          : "Microphone access was denied or unavailable.",
      );
    }
  }, [kind]);

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
      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { video: true, audio: true } : { audio: true },
      ));
      streamRef.current = stream;
      setPreviewStream(stream);
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
  }, [kind, onCapture]);

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
    openPreview,
    closePreview,
    start,
    stop,
    cancel,
    pause,
    resume,
  };
}
