"use client";

import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UploadItem } from "@/hooks/use-media-upload";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadQueueProps {
  items: UploadItem[];
  onCaptionChange: (id: string, caption: string) => void;
  onRemove: (id: string) => void;
  onUploadAll: () => void;
  /** Hides the per-item caption input — off for the public "share a memory" page (see MediaUploadsSection's showCaption prop) to keep that flow to the fewest possible fields. Defaults to true (shown). */
  showCaption?: boolean;
}

/**
 * Shared queue UI reused by photo/video/audio uploaders: one row per
 * picked/recorded file with an optional caption field, status
 * indicator, and a single "Upload All" action. Stacks full-width on
 * mobile.
 */
export function UploadQueue({ items, onCaptionChange, onRemove, onUploadAll, showCaption = true }: UploadQueueProps) {
  if (items.length === 0) return null;

  const hasPending = items.some((it) => it.status === "pending" || it.status === "error");
  const isUploading = items.some((it) => it.status === "uploading");

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-2 rounded-xl border border-navy-950/10 bg-white p-3 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-950">{item.file.name}</p>
              <p className="text-xs text-navy-700/50">{formatBytes(item.file.size)}</p>
            </div>
          </div>

          {showCaption ? (
            <input
              type="text"
              value={item.caption}
              onChange={(e) => onCaptionChange(item.id, e.target.value)}
              placeholder="Add a caption (optional)"
              disabled={item.status === "uploading" || item.status === "done"}
              className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 sm:w-56"
            />
          ) : null}

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
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

            {item.status !== "uploading" && item.status !== "done" ? (
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onRemove(item.id)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {hasPending ? (
        <Button onClick={onUploadAll} disabled={isUploading} className="w-full sm:w-auto">
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Uploading...
            </>
          ) : (
            "Upload All"
          )}
        </Button>
      ) : null}
    </div>
  );
}
