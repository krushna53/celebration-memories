"use client";

import { useRef, useState } from "react";
import { Check, Clapperboard, Loader2, Sparkles, Upload } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useTimelineMovieJob } from "@/hooks/use-timeline-movie-job";
import { requestTimelineMovieUploadUrlAction, confirmTimelineMovieUploadAction } from "@/features/admin/timeline-movie/actions";
import type { HeygenAvatar, HeygenVoice } from "@/lib/heygen";

export interface TimelineMovieMilestoneInput {
  id: string;
  period: string;
  title: string;
  description: string;
  imageUrl: string | null;
}

interface TimelineMovieComposerProps {
  eventId: string;
  milestones: TimelineMovieMilestoneInput[];
  /** Extra Gallery photos to use as filler backgrounds for milestones that have no photo of their own. */
  fallbackPhotoUrls: string[];
  avatars: HeygenAvatar[];
  voices: HeygenVoice[];
  quota: { used: number; limit: number } | null;
  initialVideoUrl?: string | null;
  /** False if HEYGEN_API_KEY isn't set — the AI tab shows a "not configured" message instead of the picker, same convention as AI Image/AI CSS/Slideshow Video. Upload mode is unaffected. */
  heygenConfigured: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  starting: "Starting...",
  processing: "Rendering — this can take a few minutes for a multi-scene video...",
};

const pillClass = (active: boolean) =>
  `rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
    active
      ? "border-gold-500 bg-gold-500/10 text-gold-700"
      : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
  }`;

function buildScript(m: TimelineMovieMilestoneInput): string {
  const parts = [m.period ? `${m.period} —` : "", m.title, m.description].filter(Boolean);
  return parts.join(" ").trim() || m.title;
}

export function TimelineMovieComposer({
  eventId,
  milestones,
  fallbackPhotoUrls,
  avatars,
  voices,
  quota,
  initialVideoUrl = null,
  heygenConfigured,
}: TimelineMovieComposerProps) {
  const [mode, setMode] = useState<"ai" | "upload">(heygenConfigured ? "ai" : "upload");
  const [selectedIds, setSelectedIds] = useState<string[]>(milestones.slice(0, 8).map((m) => m.id));
  const [avatarId, setAvatarId] = useState(avatars[0]?.avatarId ?? "");
  const [voiceId, setVoiceId] = useState(voices[0]?.voiceId ?? "");

  const { status, error, videoUrl, remaining, generate, cancel } = useTimelineMovieJob(initialVideoUrl);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingCount = remaining ?? (quota ? quota.limit - quota.used : null);
  const atLimit = remainingCount !== null && remainingCount <= 0;
  const busy = status === "starting" || status === "processing" || uploading;
  const resultUrl = uploadedUrl ?? videoUrl;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    const selected = selectedIds
      .map((id) => milestones.find((m) => m.id === id))
      .filter((m): m is TimelineMovieMilestoneInput => Boolean(m));

    if (selected.length === 0) {
      return;
    }

    let fallbackIndex = 0;
    const scenes = selected.map((m) => {
      let backgroundUrl = m.imageUrl;
      if (!backgroundUrl && fallbackPhotoUrls.length > 0) {
        backgroundUrl = fallbackPhotoUrls[fallbackIndex % fallbackPhotoUrls.length] ?? null;
        fallbackIndex += 1;
      }
      return { script: buildScript(m), backgroundUrl };
    });

    await generate({ eventId, scenes, avatarId, voiceId });
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      if (file.type !== "video/mp4" && file.type !== "video/quicktime") {
        throw new Error("Only MP4 or MOV video is supported.");
      }
      if (file.size > 1024 * 1024 * 1024) {
        throw new Error("File is too large — limited to 1GB.");
      }

      const signed = await requestTimelineMovieUploadUrlAction(eventId, file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadErr } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadErr) throw new Error(uploadErr.message);

      const confirmed = await confirmTimelineMovieUploadAction(eventId, path);
      if (!confirmed.success) throw new Error(confirmed.error);

      setUploadedUrl(confirmed.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (milestones.length === 0 && mode === "ai") {
    return (
      <div className="rounded-xl border border-dashed border-navy-950/15 bg-white p-8 text-center">
        <Clapperboard className="mx-auto text-navy-700/30" size={28} />
        <h3 className="mt-3 font-display text-lg text-navy-950">No Timeline entries yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-700/60">
          Add some milestones in Timeline first, or switch to &ldquo;Upload your own video&rdquo; below.
        </p>
        <button type="button" onClick={() => setMode("upload")} className="mt-4 text-sm font-medium text-gold-700 underline underline-offset-2">
          Upload your own video instead
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("ai")} className={pillClass(mode === "ai")}>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={14} /> Generate with AI
          </span>
        </button>
        <button type="button" onClick={() => setMode("upload")} className={pillClass(mode === "upload")}>
          <span className="inline-flex items-center gap-1.5">
            <Upload size={14} /> Upload your own video
          </span>
        </button>
      </div>

      {mode === "ai" && !heygenConfigured ? (
        <div className="rounded-xl border border-dashed border-navy-950/15 bg-white p-6 text-center text-sm text-navy-700/60">
          AI generation isn&rsquo;t configured yet — HEYGEN_API_KEY hasn&rsquo;t been set. Use &ldquo;Upload your own
          video&rdquo; instead, or ask the site owner to add a HeyGen API key.
        </div>
      ) : mode === "ai" ? (
        <div className="rounded-xl border border-navy-950/10 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/50">
            Timeline entries to narrate ({selectedIds.length} selected)
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {milestones.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-luxury duration-200 ${
                  selectedIds.includes(m.id) ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-navy-950">{m.title}</span>
                  <span className="block text-xs text-navy-700/50">{m.period}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-navy-700/50">AI host avatar</span>
              <select
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
              >
                {avatars.map((a) => (
                  <option key={a.avatarId} value={a.avatarId}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-navy-700/50">Voice</span>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
              >
                {voices.map((v) => (
                  <option key={v.voiceId} value={v.voiceId}>
                    {v.name}
                    {v.language ? ` (${v.language})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy || atLimit || selectedIds.length === 0 || !avatarId || !voiceId}
              className="tap-target inline-flex items-center gap-2 rounded-lg bg-navy-950 px-4 py-2 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate Movie
            </button>
            {busy ? (
              <button type="button" onClick={cancel} className="text-sm text-navy-700/60 underline underline-offset-2">
                Cancel
              </button>
            ) : null}
            {status !== "idle" && STATUS_LABEL[status] ? (
              <span className="text-sm text-navy-700/60">{STATUS_LABEL[status]}</span>
            ) : null}
            {status === "error" && error ? (
              <span className="text-sm text-red-600" role="alert">
                {error}
              </span>
            ) : null}
            {remainingCount !== null ? (
              <span className="text-xs text-navy-700/50">{Math.max(0, remainingCount)} AI render(s) left for this event</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-navy-950/10 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/50">Video file</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="tap-target inline-flex items-center gap-2 rounded-lg border border-navy-950/15 px-3.5 py-2 text-sm font-medium text-navy-700 transition-luxury duration-200 hover:border-gold-500 hover:text-gold-700 disabled:cursor-wait disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload
            </button>
            <p className="text-xs text-navy-700/50">MP4 or MOV, up to 1GB. Not counted against the AI generation limit.</p>
          </div>
          {uploadError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      )}

      {resultUrl ? (
        <div className="rounded-xl border border-navy-950/10 bg-white p-5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <Check size={14} /> Ready
          </p>
          <video src={resultUrl} controls className="mt-3 aspect-video w-full max-w-lg rounded-lg border border-navy-950/10 bg-black" />
          <div className="mt-3 flex items-center gap-3">
            <a
              href={resultUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-950/15 px-3.5 py-2 text-sm font-medium text-navy-700 transition-luxury duration-200 hover:border-gold-500 hover:text-gold-700"
            >
              Download
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
