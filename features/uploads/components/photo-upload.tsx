"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";

import type { useMediaUpload } from "@/hooks/use-media-upload";
import { UploadQueue } from "@/features/uploads/components/upload-queue";

interface PhotoUploadProps {
  /**
   * Owned by the parent (MediaUploadsSection) rather than called here
   * directly — every upload kind's queue must survive navigating away
   * to another action and back, which it can't do if each component
   * holds its own local useMediaUpload state and gets unmounted when
   * the guest switches views. See MediaUploadsSection's doc comment.
   */
  upload: ReturnType<typeof useMediaUpload>;
}

/** Multi-photo picker with preview captions, per CLAUDE.md → Guest Uploads. */
export function PhotoUpload({ upload }: PhotoUploadProps) {
  const { items, addFiles, setCaption, remove, uploadAll } = upload;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-500/30 bg-gold-500/5 px-4 py-8 text-center transition-luxury duration-200 hover:border-gold-500/60 hover:bg-gold-500/10"
      >
        <ImagePlus className="text-gold-500" size={28} />
        <span className="text-sm font-medium text-navy-950">
          Tap to choose photos
        </span>
        <span className="text-xs text-navy-700/60">
          JPEG, PNG, WEBP or HEIC · up to 50MB each
        </span>
      </button>

      <UploadQueue
        items={items}
        onCaptionChange={setCaption}
        onRemove={remove}
        onUploadAll={uploadAll}
      />
    </div>
  );
}
