"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Square, UploadCloud, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { UploadQueue } from "@/features/uploads/components/upload-queue";

interface VideoUploadProps {
  token: string;
  /** Which mode to land in immediately — set to "record" so tapping the Record Video icon in MediaUploadsSection's menu skips straight to the camera view instead of requiring a second tap. Defaults to "upload". The toggle below still lets the guest switch either way after landing. */
  initialMode?: "upload" | "record";
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Video upload — an existing file, or record directly from the browser. */
export function VideoUpload({ token, initialMode = "upload" }: VideoUploadProps) {
  const { items, addFiles, setCaption, remove, uploadAll } = useMediaUpload(token, "video");
  const [mode, setMode] = useState<"upload" | "record">(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  const { isRecording, seconds, previewStream, error, start, stop } = useMediaRecorder({
    kind: "video",
    onCapture: (file) => addFiles([file]),
  });

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

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
          Upload a video
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
          Record instead
        </button>
      </div>

      {mode === "upload" ? (
        <>
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
            <span className="text-xs text-navy-700/60">MP4 or MOV · up to 250MB</span>
          </button>
        </>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-navy-950/10 bg-navy-950 p-4">
          {isRecording ? (
            <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full rounded-lg object-cover" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-navy-900 text-ivory-100/40">
              <Video size={32} />
            </div>
          )}

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
