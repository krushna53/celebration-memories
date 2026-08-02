"use client";

import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";

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
  /** Passed straight through to UploadQueue — see its doc comment. */
  showCaption?: boolean;
}

/**
 * Multi-photo picker with preview captions, per CLAUDE.md → Guest
 * Uploads. Offers two entry points side by side: the regular gallery
 * picker, and a "Take a Photo" button that opens the device camera
 * directly via the file input's `capture` attribute. A photo doesn't
 * need the full custom camera UI built for video/audio (no pause/
 * cancel/preview-before-shooting makes sense for a single still shot)
 * — the native camera app the OS already provides is faster and more
 * familiar than reimplementing one just for photos.
 */
export function PhotoUpload({ upload, showCaption = true }: PhotoUploadProps) {
  const { items, addFiles, setCaption, remove, uploadAll } = upload;
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      {/* A second, near-identical input rather than toggling `capture`
          on/off the one above — some mobile browsers cache the picker
          choice (gallery vs. camera) per input the first time it's
          used, so a single shared input can get "stuck" always opening
          whichever one was picked first. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-500/30 bg-gold-500/5 px-3 py-8 text-center transition-luxury duration-200 hover:border-gold-500/60 hover:bg-gold-500/10"
        >
          <ImagePlus className="text-gold-500" size={28} />
          <span className="text-sm font-medium text-navy-950">Choose from Gallery</span>
          <span className="text-xs text-navy-700/60">Up to 50MB each</span>
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-500/30 bg-gold-500/5 px-3 py-8 text-center transition-luxury duration-200 hover:border-gold-500/60 hover:bg-gold-500/10"
        >
          <Camera className="text-gold-500" size={28} />
          <span className="text-sm font-medium text-navy-950">Take a Photo</span>
          <span className="text-xs text-navy-700/60">Opens your camera</span>
        </button>
      </div>

      <UploadQueue
        items={items}
        onCaptionChange={setCaption}
        onRemove={remove}
        onUploadAll={uploadAll}
        showCaption={showCaption}
      />
    </div>
  );
}
