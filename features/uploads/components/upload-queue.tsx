"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ImageOff, Loader2, RotateCcw, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UploadItem } from "@/hooks/use-media-upload";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Small inline thumbnail for photos — sits next to the filename, same as before. Tapping/long-pressing a plain image doesn't have the same "too small to hit the play button" problem a tiny video does, so this one stays compact. */
function PhotoThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  if (imageFailed) {
    // HEIC/HEIF photos preview fine on Safari but most other browsers
    // can't decode them for an <img> tag — falls back to a plain icon
    // rather than a broken-image glyph.
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-navy-950/5 text-navy-700/30">
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onError={() => setImageFailed(true)}
      className="h-14 w-14 shrink-0 rounded-lg object-cover"
    />
  );
}

/**
 * Full-width video/audio player so a guest can actually check "did
 * that take come out okay?" — a tiny thumbnail-sized <video> used to
 * make the native play button so small that a tap often registered as
 * a long-press instead, popping up the browser's own context menu
 * (Full screen/Download/Mute/...) rather than just playing. Sized big
 * enough for the native controls to be comfortably tappable. Built
 * from the File object already in memory (via URL.createObjectURL),
 * so it works the instant something's picked or recorded, not just
 * after the upload finishes.
 */
function MediaPlayer({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  if (file.type.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-lg bg-black object-contain"
      />
    );
  }

  if (file.type.startsWith("audio/")) {
    return <audio src={url} controls preload="metadata" className="h-10 w-full" />;
  }

  return null;
}

interface UploadQueueProps {
  items: UploadItem[];
  onCaptionChange: (id: string, caption: string) => void;
  onRemove: (id: string) => void;
  onUploadAll: () => void;
  /** Hides the per-item caption input — off for the public "share a memory" page (see MediaUploadsSection's showCaption prop) to keep that flow to the fewest possible fields. Defaults to true (shown). */
  showCaption?: boolean;
  /** Video/audio uploaders only — deletes the item (see onRemove) and drops the guest straight back into the camera/mic view for another take, in one tap instead of "Delete" then hunting for "Record instead" again. Omitted entirely for photos, where there's no equivalent single action. */
  onRecordAgain?: (id: string) => void;
}

/**
 * Shared queue UI reused by photo/video/audio uploaders: one row per
 * picked/recorded file with a live preview, an optional caption field,
 * status indicator, and a single "Upload All" action. Stacks full-width
 * on mobile.
 */
export function UploadQueue({
  items,
  onCaptionChange,
  onRemove,
  onUploadAll,
  showCaption = true,
  onRecordAgain,
}: UploadQueueProps) {
  if (items.length === 0) return null;

  const pendingCount = items.filter((it) => it.status === "pending" || it.status === "error").length;
  const hasPending = pendingCount > 0;
  const isUploading = items.some((it) => it.status === "uploading");

  function handleDelete(item: UploadItem) {
    // Only items that already finished uploading are asked to confirm —
    // deleting one of those also removes it from the server (see
    // useMediaUpload's remove()), unlike dropping a still-pending pick,
    // which never left the browser in the first place.
    if (item.status === "done") {
      const confirmed = window.confirm("Delete this memory? This can't be undone.");
      if (!confirmed) return;
    }
    onRemove(item.id);
  }

  const isPhoto = (file: File) => file.type.startsWith("image/");
  const isPlayable = (file: File) => file.type.startsWith("video/") || file.type.startsWith("audio/");

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-navy-950/10 bg-white p-3">
          <div className="flex items-start gap-3">
            {isPhoto(item.file) ? <PhotoThumbnail file={item.file} /> : null}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-950">{item.file.name}</p>
              <p className="text-xs text-navy-700/50">{formatBytes(item.file.size)}</p>
              <span
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs",
                  item.status === "done" && "text-green-700",
                  item.status === "error" && "text-red-600",
                  item.status === "uploading" && "text-gold-600",
                )}
              >
                {item.status === "uploading" && <Loader2 size={14} className="animate-spin" />}
                {item.status === "done" && <CheckCircle2 size={14} />}
                {item.status === "error" && <AlertCircle size={14} />}
                {item.status === "error" ? item.error : item.status === "done" ? "Uploaded" : null}
              </span>
            </div>

            {item.status !== "uploading" ? (
              <button
                type="button"
                aria-label="Delete"
                onClick={() => handleDelete(item)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
              >
                {item.status === "done" ? <Trash2 size={16} /> : <X size={16} />}
              </button>
            ) : null}
          </div>

          {isPlayable(item.file) ? <MediaPlayer file={item.file} /> : null}

          {showCaption ? (
            <input
              type="text"
              value={item.caption}
              onChange={(e) => onCaptionChange(item.id, e.target.value)}
              placeholder="Add a caption (optional)"
              disabled={item.status === "uploading" || item.status === "done"}
              className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            />
          ) : null}

          {item.status === "done" && onRecordAgain ? (
            <button
              type="button"
              onClick={() => onRecordAgain(item.id)}
              className="tap-target flex items-center gap-1.5 self-start text-xs font-medium text-gold-600 hover:text-gold-700"
            >
              <RotateCcw size={13} />
              Not happy with it? Delete &amp; record again
            </button>
          ) : null}
        </div>
      ))}

      {hasPending ? (
        <Button onClick={onUploadAll} disabled={isUploading} className="w-full sm:w-auto">
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Uploading...
            </>
          ) : pendingCount === 1 ? (
            "Upload"
          ) : (
            "Upload All"
          )}
        </Button>
      ) : null}
    </div>
  );
}
