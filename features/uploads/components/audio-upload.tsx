"use client";

import { useRef, useState } from "react";
import { Circle, Mic, Square, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { UploadQueue } from "@/features/uploads/components/upload-queue";

interface AudioUploadProps {
  token: string;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Audio upload — an existing file, or record a voice message in-browser. */
export function AudioUpload({ token }: AudioUploadProps) {
  const { items, addFiles, setCaption, remove, uploadAll } = useMediaUpload(token, "audio");
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const { isRecording, seconds, error, start, stop } = useMediaRecorder({
    kind: "audio",
    onCapture: (file) => addFiles([file]),
  });

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
              isRecording ? "bg-red-600/20 text-red-400" : "bg-gold-500/15 text-gold-300",
            )}
          >
            <Mic size={26} />
          </div>

          {isRecording ? (
            <p className="font-display text-lg text-gold-300 tabular-nums">
              {formatSeconds(seconds)}
            </p>
          ) : null}

          <button
            type="button"
            onClick={isRecording ? stop : start}
            className={cn(
              "tap-target flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-luxury duration-200",
              isRecording ? "bg-red-600 text-white" : "bg-gold-500 text-navy-950",
            )}
          >
            {isRecording ? <Square size={16} /> : <Circle size={16} />}
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
      )}

      <UploadQueue
        items={items}
        onCaptionChange={setCaption}
        onRemove={remove}
        onUploadAll={uploadAll}
      />
    </div>
  );
}
