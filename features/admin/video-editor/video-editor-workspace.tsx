"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, Controls, Edit, Timeline, UIController } from "@shotstack/shotstack-studio";
import { ImageIcon, Loader2, Upload, VideoIcon, Save, MonitorPlay, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { VideoEditorClip, VideoEditJob } from "@/services/video-editor";
import {
  confirmVideoEditorUploadAction,
  requestVideoEditorUploadAction,
  saveVideoEditDraftAction,
  setBigScreenVideoAction,
} from "@/features/admin/video-editor/actions";
import { useVideoEditRender } from "@/hooks/use-video-edit-render";

// The starting point for a brand-new edit — NO tracks yet, a black
// background, MP4/SD output. Matches the Edit JSON schema Shotstack's
// Edit API renders directly (see
// https://shotstack.io/docs/guide/getting-started/core-concepts/) —
// edit.getEdit() later returns this same shape with clips filled in,
// which is exactly what gets POSTed to the render endpoint (task #83).
//
// Deliberately `tracks: []`, NOT `tracks: [{ clips: [] }]` — the
// Studio SDK validates the Edit against Shotstack's schema on load,
// and a track with an empty `clips` array fails that validation
// ("Too small: expected array to have >=1 items" at
// timeline.tracks.0.clips) — a real bug this shipped with, only
// surfacing the first time someone opened a genuinely fresh event with
// no draft yet. A track simply doesn't exist until it has its first
// clip; addClipToTimeline below creates the track (via edit.addTrack)
// the moment the very first clip is added, rather than creating an
// empty, invalid one upfront.
//
// A plain function (rather than a shared object constant) so the object
// literal is inline at the `new Edit(...)` call site — TypeScript then
// contextually types "mp4"/"sd" against Edit's constructor parameter
// (narrowing them to their literal types) instead of widening to
// `string`, which a separately-declared `const` would do without an
// awkward `as const` that then fights the SDK's expected *mutable*
// array shape for tracks/clips.
function createEmptyEdit(): Edit {
  return new Edit({
    timeline: {
      tracks: [],
      background: "#000000",
    },
    output: {
      format: "mp4",
      resolution: "sd",
    },
  });
}

/** True, human-readable message for a known failure shape — never shows a raw Zod/schema error dump to the person using the editor. Falls back to a generic, still-reassuring message for anything unrecognized. */
function describeLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("too_small") && raw.includes("clips")) {
    return "This edit's data looks incomplete, so the editor couldn't open it.";
  }
  if (raw.toLowerCase().includes("webgl") || raw.toLowerCase().includes("context")) {
    return "Your browser couldn't start the video canvas. This editor needs a browser with WebGL support (most current Chrome, Safari, or Edge).";
  }
  if (raw.toLowerCase().includes("network") || raw.toLowerCase().includes("fetch")) {
    return "A network problem stopped the editor from loading.";
  }
  return "Something went wrong loading the editor.";
}

const AUTOSAVE_INTERVAL_MS = 20_000;

interface StudioInstance {
  edit: Edit;
  canvas: Canvas;
  timeline: Timeline;
  controls: Controls;
}

export function VideoEditorWorkspace({
  eventId,
  initialMediaLibrary,
  initialJobs,
  quota,
}: {
  eventId: string;
  initialMediaLibrary: VideoEditorClip[];
  initialJobs: VideoEditJob[];
  quota: { used: number; limit: number } | null;
}) {
  const studioContainerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<StudioInstance | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null);
  const [showLoadErrorDetail, setShowLoadErrorDetail] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mediaLibrary, setMediaLibrary] = useState(initialMediaLibrary);
  const [jobs, setJobs] = useState(initialJobs);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled edit");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bigScreenBusyId, setBigScreenBusyId] = useState<string | null>(null);

  const atCap = quota ? quota.used >= quota.limit : false;

  // Mount the Studio SDK once. See features/admin/video-editor/
  // video-editor-client-boundary.tsx for why this whole component only
  // ever runs in the browser (next/dynamic ssr:false) — Canvas/Timeline
  // need real DOM/WebGL, which doesn't exist during Next.js's server
  // render.
  useEffect(() => {
    let disposed = false;
    setReady(false);
    setLoadError(null);
    setLoadErrorDetail(null);

    async function init() {
      try {
        const edit = createEmptyEdit();
        const canvas = new Canvas(edit);
        await canvas.load();
        await edit.load();

        UIController.create(edit, canvas);

        const timelineEl = timelineContainerRef.current;
        if (!timelineEl) throw new Error("Timeline container not found.");
        const timeline = new Timeline(edit, timelineEl);
        await timeline.load();

        const controls = new Controls(edit);
        await controls.load();

        if (disposed) {
          canvas.dispose();
          timeline.dispose();
          return;
        }

        instanceRef.current = { edit, canvas, timeline, controls };
        setReady(true);
      } catch (err) {
        console.error("Video Editor: failed to load Shotstack Studio SDK:", err);
        if (!disposed) {
          setLoadError(describeLoadError(err));
          setLoadErrorDetail(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();

    return () => {
      disposed = true;
      instanceRef.current?.canvas.dispose();
      instanceRef.current?.timeline.dispose();
      instanceRef.current = null;
    };
    // reloadKey is a deliberate, otherwise-unused dependency — bumping it
    // (the error screen's "Try Again" button) re-runs this whole mount
    // effect to retry loading the editor without a full page refresh.
  }, [reloadKey]);

  const saveDraft = useCallback(async (): Promise<string | null> => {
    const instance = instanceRef.current;
    if (!instance) return null;

    setSaveState("saving");
    const editJson = instance.edit.getEdit();
    const result = await saveVideoEditDraftAction(eventId, currentJobId, title, editJson);
    if (result.success) {
      setCurrentJobId(result.jobId);
      setSaveState("saved");
      return result.jobId;
    }
    setSaveState("error");
    return null;
  }, [eventId, currentJobId, title]);

  // Autosave on an interval so a closed tab never loses progress — see
  // saveVideoEditDraft's doc comment in services/video-editor.ts.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(saveDraft, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ready, saveDraft]);

  function addClipToTimeline(clip: VideoEditorClip) {
    const instance = instanceRef.current;
    if (!instance) return;

    const length = clip.kind === "photo" ? 4 : 5;
    const start = instance.edit.totalDuration ?? 0;
    const asset = clip.kind === "photo" ? ({ type: "image", src: clip.url } as const) : ({ type: "video", src: clip.url } as const);

    // createEmptyEdit() starts with zero tracks (a track with 0 clips
    // fails Shotstack's schema validation — see that function's doc
    // comment), so the very first clip has to create track 0 itself,
    // already carrying that clip — addClip(0, ...) would fail here
    // since there's no track 0 to add to yet. Every clip after the
    // first goes through the normal addClip path.
    if (instance.edit.getEdit().timeline.tracks.length === 0) {
      instance.edit.addTrack(0, { clips: [{ asset, start, length }] });
    } else {
      instance.edit.addClip(0, { asset, start, length });
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const requested = await requestVideoEditorUploadAction(eventId, file.name, file.type, file.size);
    if (!requested.success) {
      setUploadError(requested.error);
      setUploading(false);
      return;
    }

    const putResponse = await fetch(requested.data.signedUrl, { method: "PUT", body: file });
    if (!putResponse.ok) {
      setUploadError("Upload failed — please try again.");
      setUploading(false);
      return;
    }

    const confirmed = await confirmVideoEditorUploadAction(eventId, requested.data.path, file.name);
    setUploading(false);
    if (!confirmed.success) {
      setUploadError(confirmed.error);
      return;
    }

    // Optimistic add to the media bin — a full page data reload isn't
    // needed just to see the file you just uploaded.
    setMediaLibrary((prev) => [
      {
        id: `upload-pending-${Date.now()}`,
        kind: "video",
        source: "upload",
        url: URL.createObjectURL(file),
        thumbnailUrl: null,
        label: file.name,
        approved: true,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  async function handleSetBigScreen(jobId: string) {
    setBigScreenBusyId(jobId);
    const result = await setBigScreenVideoAction(eventId, jobId);
    setBigScreenBusyId(null);
    if (result.success) {
      setJobs((prev) => prev.map((j) => ({ ...j, isLiveOnBigScreen: j.id === jobId })));
    }
  }

  const renderJob = useVideoEditRender();

  async function handleRender() {
    if (atCap) return;
    // Save first so the job row has the latest edit_json before the Edge
    // Function reads it — a render started from a stale/never-saved draft
    // would silently miss whatever was added since the last autosave.
    const jobId = await saveDraft();
    if (!jobId) return;
    await renderJob.render(jobId, eventId);
  }

  // Once a render finishes, fold it into the history list so "Set as Big
  // Screen" is immediately available without a full page reload.
  useEffect(() => {
    if (renderJob.status !== "done" || !renderJob.resultUrl || !currentJobId) return;
    setJobs((prev) => {
      if (prev.some((j) => j.id === currentJobId && j.status === "done")) return prev;
      const rest = prev.filter((j) => j.id !== currentJobId);
      return [
        {
          id: currentJobId,
          eventId,
          title,
          editJson: null,
          status: "done",
          resultUrl: renderJob.resultUrl,
          errorMessage: null,
          isLiveOnBigScreen: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...rest,
      ];
    });
  }, [renderJob.status, renderJob.resultUrl, currentJobId, eventId, title]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Media bin — every photo/video this event has, plus custom uploads */}
      <div className="order-2 lg:order-1">
        <div className="rounded-xl border border-navy-950/10 bg-white p-4">
          <h2 className="font-display text-base text-navy-950">Media</h2>
          <p className="mt-1 text-xs text-navy-700/50">Tap a photo or video to add it to the end of the timeline.</p>

          <label className="tap-target mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold-500/40 px-3 py-2.5 text-xs font-medium text-gold-700 hover:border-gold-500 hover:bg-gold-500/5">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading..." : "Upload a video"}
            <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          {uploadError ? (
            <p className="mt-1.5 text-xs text-red-600" role="alert">
              {uploadError}
            </p>
          ) : null}

          <div className="mt-3 grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto">
            {mediaLibrary.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => addClipToTimeline(clip)}
                disabled={!ready}
                className="group relative aspect-square overflow-hidden rounded-lg border border-navy-950/10 bg-navy-950/5 disabled:cursor-not-allowed disabled:opacity-50"
                title={clip.label ?? undefined}
              >
                {clip.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.url} alt={clip.label ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-navy-950/10 text-navy-700/50">
                    <VideoIcon size={20} />
                  </div>
                )}
                {!clip.approved ? (
                  <span className="absolute left-1 top-1 rounded-full bg-gold-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-navy-950">
                    Pending
                  </span>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-navy-950/70 px-1.5 py-0.5 text-[9px] text-ivory-50 opacity-0 group-hover:opacity-100">
                  {clip.source}
                </span>
              </button>
            ))}
            {mediaLibrary.length === 0 ? (
              <p className="col-span-2 py-6 text-center text-xs text-navy-700/50">
                <ImageIcon size={18} className="mx-auto mb-1" />
                No photos or videos yet.
              </p>
            ) : null}
          </div>
        </div>

        {/* Past renders + drafts */}
        {jobs.length > 0 ? (
          <div className="mt-4 rounded-xl border border-navy-950/10 bg-white p-4">
            <h2 className="font-display text-base text-navy-950">Your Edits</h2>
            <ul className="mt-2 space-y-2">
              {jobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-navy-950/10 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-navy-950">{job.title}</span>
                    <span className="shrink-0 rounded-full bg-navy-950/5 px-1.5 py-0.5 text-[9px] uppercase text-navy-700/60">
                      {job.status}
                    </span>
                  </div>
                  {job.status === "done" && job.resultUrl ? (
                    <div className="mt-2 flex items-center gap-2">
                      <a href={job.resultUrl} target="_blank" rel="noreferrer" className="text-gold-700 hover:underline">
                        View render
                      </a>
                      <button
                        type="button"
                        onClick={() => handleSetBigScreen(job.id)}
                        disabled={job.isLiveOnBigScreen || bigScreenBusyId === job.id}
                        className="ml-auto flex items-center gap-1 text-navy-700/60 hover:text-navy-950 disabled:opacity-50"
                      >
                        {job.isLiveOnBigScreen ? (
                          <>
                            <CheckCircle2 size={12} /> Live
                          </>
                        ) : bigScreenBusyId === job.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            <MonitorPlay size={12} /> Set as Big Screen
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Editor canvas + timeline */}
      <div className="order-1 lg:order-2">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled edit"
            className="rounded-lg border border-navy-950/15 bg-white px-3 py-1.5 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={!ready}>
            {saveState === "saving" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <Save size={14} /> Save
              </>
            )}
          </Button>
          {saveState === "saved" ? <span className="text-xs text-navy-700/50">Saved</span> : null}
          {saveState === "error" ? <span className="text-xs text-red-600">Couldn&rsquo;t save</span> : null}

          <div className="ml-auto flex items-center gap-2">
            {renderJob.status === "processing" || renderJob.status === "starting" ? (
              <span className="text-xs text-navy-700/50">Rendering — this can take a minute or two...</span>
            ) : null}
            <Button size="sm" onClick={handleRender} disabled={!ready || atCap || renderJob.status === "starting" || renderJob.status === "processing"}>
              {renderJob.status === "starting" || renderJob.status === "processing" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Render Video"
              )}
            </Button>
          </div>
        </div>

        {renderJob.status === "done" && renderJob.resultUrl ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle2 size={13} /> Render complete —{" "}
            <a href={renderJob.resultUrl} target="_blank" rel="noreferrer" className="underline">
              view it
            </a>{" "}
            or set it as the Big Screen video below.
          </p>
        ) : null}
        {renderJob.status === "error" && renderJob.error ? (
          <p className="mb-2 text-xs text-red-600" role="alert">
            {renderJob.error}
          </p>
        ) : null}

        {atCap ? (
          <p className="mb-2 text-xs text-red-600">
            You&rsquo;ve reached the render limit for this event ({quota?.limit}). Contact your site admin to raise it.
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-medium">The video editor couldn&rsquo;t open.</p>
            <p className="mt-1 text-red-700">{loadError}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                Try Again
              </Button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-xs text-red-700 underline underline-offset-2 hover:text-red-900"
              >
                Reload the whole page instead
              </button>
            </div>
            {loadErrorDetail ? (
              <div className="mt-3 border-t border-red-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLoadErrorDetail((v) => !v)}
                  className="text-xs text-red-700/70 underline underline-offset-2 hover:text-red-900"
                >
                  {showLoadErrorDetail ? "Hide" : "Show"} technical details
                </button>
                {showLoadErrorDetail ? (
                  <p className="mt-2 break-words rounded-lg bg-white/60 p-2 font-mono text-[11px] text-red-900/80">
                    {loadErrorDetail}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-navy-950">
            <div data-shotstack-studio ref={studioContainerRef} className="aspect-video w-full" />
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
          <div data-shotstack-timeline ref={timelineContainerRef} className="h-48 w-full" />
        </div>

        {!ready && !loadError ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-navy-700/50">
            <Loader2 size={12} className="animate-spin" /> Loading editor...
          </div>
        ) : null}
      </div>
    </div>
  );
}
