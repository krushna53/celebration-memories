"use client";

import { useRef, useState } from "react";
import { Circle, Mic, Pause, Play, RotateCcw, Square, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { useMediaUpload } from "@/hooks/use-media-upload";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { UploadQueue } from "@/features/uploads/components/upload-queue";

interface AudioUploadProps {
  /** Owned by the parent (MediaUploadsSection) — see PhotoUpload's doc comment for why. */
  upload: ReturnType<typeof useMediaUpload>;
  /** Which mode to land in immediately — set to "record" so tapping the Record Audio icon in MediaUploadsSection's menu skips straight to the mic view instead of requiring a second tap. Defaults to "upload". The toggle below still lets the guest switch either way after landing. */
  initialMode?: "upload" | "record";
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Audio upload — an existing file, or record a voice message in-browser. */
export function AudioUpload({ upload, initialMode = "upload" }: AudioUploadProps) {
  const { items, addFiles, setCaption, remove, uploadAll } = upload;
  const [mode, setMode] = useState<"upload" | "record">(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the item just added by a recording so "Record again" can
  // discard exactly that take, without touching anything the guest
  // separately picked from the file library.
  const [lastRecordedId, setLastRecordedId] = useState<string | null>(null);

  const { isRecording, isPaused, seconds, error, start, stop, cancel, pause, resume } = useMediaRecorder({
    kind: "audio",
    onCapture: (file) => {
      const [id] = addFiles([file]);
      setLastRecordedId(id ?? null);
    },
  });

  function recordAgain() {
    if (lastRecordedId) remove(lastRecordedId);
    setLastRecordedId(null);
    start();
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn(
            "flex-1 rounded-lg border px-4 py-2 text-sm transition-luxury duration-200",
            mode === "upload"
              ? "border-gold-500 bg-gold-500/10 text-navy-950 font-medium"
              : "border-navy-950/15 text-navy-700/70",
          )}
        >
          Upload audio
        </button>
        <button
          type="button"
          onClick={() => setMode("record")}
          className={cn(
            "flex-1 rounded-lg border px-4 py-2 text-sm transition-luxury duration-200",
            mode === "record"
              ? "border-gold-500 bg-gold-500/10 text-navy-950 font-medium"
              : "border-navy-950/15 text-navy-700/70",
          )}
        >
          Record a message
        </button>
      </div>

      {mode === "upload" ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/webm"
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
            <span className="text-sm font-medium text-navy-950">Tap to choose an audio file</span>
            <span className="text-xs text-navy-700/60">MP3, M4A, AAC or WAV · up to 25MB</span>
          </button>
        </>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-navy-950/10 bg-navy-950 p-6">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full",
              isRecording && !isPaused ? "bg-red-600/20 text-red-400" : "bg-gold-500/15 text-gold-300",
            )}
          >
            <Mic size={26} />
          </div>

          {isRecording ? (
            <p className="font-display text-lg text-gold-300 tabular-nums">
              {formatSeconds(seconds)}
              {isPaused ? <span className="ml-2 text-xs uppercase tracking-wide text-ivory-100/50">Paused</span> : null}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={start}
                className="tap-target flex items-center gap-2 rounded-full bg-gold-500 px-6 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200"
              >
                <Circle size={16} />
                Start Recording
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={isPaused ? resume : pause}
                  className="tap-target flex items-center gap-2 rounded-full border border-ivory-100/20 px-4 py-2.5 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:border-ivory-100/40"
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="tap-target flex items-center gap-2 rounded-full border border-ivory-100/20 px-4 py-2.5 text-sm font-medium text-ivory-100/70 transition-luxury duration-200 hover:border-red-400/50 hover:text-red-300"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="tap-target flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white transition-luxury duration-200"
                >
                  <Square size={16} />
                  Stop
                </button>
              </>
            )}
          </div>

          {!isRecording && lastRecordedId ? (
            <button
              type="button"
              onClick={recordAgain}
              className="tap-target flex items-center gap-1.5 text-xs font-medium text-gold-300 hover:text-gold-200"
            >
              <RotateCcw size={13} />
              Not happy with it? Record again
            </button>
          ) : null}

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
      )}

      <UploadQueue
        items={items}
        onCaptionChange={setCaption}
        onRemove={(id) => {
          if (id === lastRecordedId) setLastRecordedId(null);
          remove(id);
        }}
        onUploadAll={uploadAll}
      />
    </div>
  );
}
