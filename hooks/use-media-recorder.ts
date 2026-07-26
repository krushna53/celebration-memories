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
 */
export function useMediaRecorder({ kind, onCapture }: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { video: true, audio: true } : { audio: true },
      );
      streamRef.current = stream;
      setPreviewStream(stream);
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `${kind}-recording-${Date.now()}.${ext}`, {
          type: mimeType,
        });
        onCapture(file);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(
        kind === "video"
          ? "Camera/microphone access was denied or unavailable."
          : "Microphone access was denied or unavailable.",
      );
    }
  }, [kind, onCapture]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewStream(null);
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { isRecording, seconds, previewStream, error, start, stop };
}
