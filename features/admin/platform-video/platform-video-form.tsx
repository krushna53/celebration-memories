"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { parseFeatureVideoUrl } from "@/lib/feature-video";
import {
  requestPlatformVideoUploadUrlAction,
  resolvePlatformVideoUploadAction,
  savePlatformVideoAction,
} from "@/features/admin/platform-video/actions";
import type { FeatureVideoSourceType, PlatformVideoSettings } from "@/services/platform-video-settings";

const pillClass = (active: boolean) =>
  `rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
    active
      ? "border-gold-500 bg-gold-500/10 text-gold-700"
      : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
  }`;

const labelClasses = "text-xs font-medium uppercase tracking-wide text-navy-700/50";

export function PlatformVideoForm({ settings }: { settings: PlatformVideoSettings }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [sourceType, setSourceType] = useState<FeatureVideoSourceType>(settings.sourceType);
  const [linkUrl, setLinkUrl] = useState(settings.sourceType === "link" ? (settings.videoUrl ?? "") : "");
  const [uploadedPath, setUploadedPath] = useState<string | null>(
    settings.sourceType === "upload" ? settings.storagePath : null,
  );
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(
    settings.sourceType === "upload" ? settings.videoUrl : null,
  );
  const [title, setTitle] = useState(settings.title ?? "");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      if (file.type !== "video/mp4" && file.type !== "video/quicktime") {
        throw new Error("Only MP4 or MOV video is supported.");
      }
      if (file.size > 1024 * 1024 * 1024) {
        throw new Error("File is too large — limited to 1GB.");
      }

      const signed = await requestPlatformVideoUploadUrlAction(file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadErr } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadErr) throw new Error(uploadErr.message);

      const resolved = await resolvePlatformVideoUploadAction(path);
      if (!resolved.success) throw new Error(resolved.error);

      setUploadedPath(path);
      setUploadedUrl(resolved.data.url);
      setStatus("idle");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveUpload() {
    setUploadedPath(null);
    setUploadedUrl(null);
    setStatus("idle");
  }

  function save() {
    setSaveError(null);
    setSaving(true);
    (async () => {
      const result = await savePlatformVideoAction({
        enabled,
        sourceType,
        videoUrl: sourceType === "link" ? linkUrl : uploadedUrl,
        storagePath: sourceType === "upload" ? uploadedPath : null,
        title,
      });
      setSaving(false);
      if (result.success) {
        setStatus("saved");
      } else {
        setStatus("error");
        setSaveError(result.error);
      }
    })();
  }

  const preview =
    sourceType === "link"
      ? parseFeatureVideoUrl(linkUrl)
      : uploadedUrl
        ? { platform: "direct" as const, embedUrl: null, directUrl: uploadedUrl }
        : null;

  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-5">
      <div>
        <p className={labelClasses}>Show on homepage</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEnabled(false);
              setStatus("idle");
            }}
            className={pillClass(!enabled)}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => {
              setEnabled(true);
              setStatus("idle");
            }}
            className={pillClass(enabled)}
          >
            On
          </button>
        </div>
      </div>

      <div className="mt-5">
        <p className={labelClasses}>Video source</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSourceType("link");
              setStatus("idle");
            }}
            className={pillClass(sourceType === "link")}
          >
            Link (YouTube / Vimeo)
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceType("upload");
              setStatus("idle");
            }}
            className={pillClass(sourceType === "upload")}
          >
            Upload a file
          </button>
        </div>
      </div>

      {sourceType === "link" ? (
        <div className="mt-4">
          <label className={labelClasses} htmlFor="feature-video-url">
            Video URL
          </label>
          <input
            id="feature-video-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setStatus("idle");
            }}
            className="mt-1.5 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <p className="mt-1.5 text-xs text-navy-700/50">
            Paste an ordinary YouTube or Vimeo watch/share link — it&rsquo;s turned into an embed automatically. A
            direct .mp4 link also works.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className={labelClasses}>Video file</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {uploadedUrl ? (
              <video src={uploadedUrl} controls className="h-24 w-40 rounded-lg border border-navy-950/10 object-cover" />
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="tap-target inline-flex items-center gap-2 rounded-lg border border-navy-950/15 px-3.5 py-2 text-sm font-medium text-navy-700 transition-luxury duration-200 hover:border-gold-500 hover:text-gold-700 disabled:cursor-wait disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadedUrl ? "Replace" : "Upload"}
            </button>
            {uploadedUrl ? (
              <button
                type="button"
                disabled={uploading}
                onClick={handleRemoveUpload}
                className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-navy-950/15 px-3 py-2 text-sm text-navy-700/70 transition-luxury duration-200 hover:border-red-300 hover:text-red-600"
              >
                <X size={14} />
                Remove
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-navy-700/50">MP4 or MOV, up to 1GB.</p>
          {uploadError ? (
            <p className="mt-1.5 text-sm text-red-600" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4">
        <label className={labelClasses} htmlFor="feature-video-title">
          Title (optional, shown above the video)
        </label>
        <input
          id="feature-video-title"
          type="text"
          placeholder="See EveryMoment in action"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setStatus("idle");
          }}
          className="mt-1.5 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
        />
      </div>

      {preview?.embedUrl ? (
        <div className="mt-5">
          <p className={labelClasses}>Preview</p>
          <div className="mt-1.5 aspect-video max-w-md overflow-hidden rounded-lg border border-navy-950/10">
            <iframe
              src={preview.embedUrl}
              className="h-full w-full"
              title="Feature video preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-navy-950 px-4 py-2 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:bg-navy-900 disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save
        </button>
        {status === "saved" ? <span className="text-sm text-emerald-600">Saved — live on the homepage now.</span> : null}
        {status === "error" && saveError ? (
          <span className="text-sm text-red-600" role="alert">
            {saveError}
          </span>
        ) : null}
      </div>
    </div>
  );
}
