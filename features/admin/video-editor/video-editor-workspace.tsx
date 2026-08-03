"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, Controls, Edit, Timeline, UIController } from "@shotstack/shotstack-studio";
import { Loader2, Upload, VideoIcon, Save, MonitorPlay, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { VideoEditorClip, VideoEditJob } from "@/services/video-editor";
import {
  confirmVideoEditorUploadAction,
  requestVideoEditorUploadAction,
  saveVideoEditDraftAction,
  setBigScreenVideoAction,
} from "@/features/admin/video-editor/actions";
import { useVideoEditRender } from "@/hooks/use-video-edit-render";

/**
 * Builds the Edit JSON for a brand-new session, seeded with exactly one
 * real clip. Matches the Edit JSON schema Shotstack's Edit API renders
 * directly (see https://shotstack.io/docs/guide/getting-started/core-concepts/)
 * — edit.getEdit() later returns this same shape with more clips filled
 * in, which is exactly what gets POSTed to the render endpoint (task #83).
 *
 * Deliberately never constructed with an empty `clips` array — the
 * Studio SDK validates the Edit against Shotstack's schema on load, and
 * a track with 0 clips fails that validation ("Too small: expected
 * array to have >=1 items" at timeline.tracks.0.clips). That's a real
 * bug this shipped with (an "empty starter edit" isn't a state
 * Shotstack's own data model can represent), and simply switching to
 * `tracks: []` wasn't a full fix either — Canvas/Timeline still need at
 * least one real clip to establish frame size/duration and initialize
 * correctly. So the SDK is never mounted at all until the admin picks
 * their first photo/video (see beginEditing below); before that, the
 * page shows a plain "add a photo or video to begin" prompt rather than
 * attempting to open an editor with nothing in it.
 */
function buildFirstClipEdit(clip: VideoEditorClip): { edit: Edit; length: number } {
  const length = clip.kind === "photo" ? 4 : 5;
  const asset = clip.kind === "photo" ? ({ type: "image", src: clip.url } as const) : ({ type: "video", src: clip.url } as const);
  const edit = new Edit({
    timeline: {
      tracks: [{ clips: [{ asset, start: 0, length }] }],
      background: "#000000",
    },
    output: {
      format: "mp4",
      resolution: "sd",
    },
  });
  return { edit, length };
}

/** True, human-readable message for a known failure shape — never shows a raw Zod/schema error dump to the person using the editor. Falls back to a generic, still-reassuring message for anything unrecognized. */
function describeLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.toLowerCase().includes("webgl") || raw.toLowerCase().includes("context")) {
    return "Your browser couldn't start the video canvas. This editor needs a browser with WebGL support (most current Chrome, Safari, or Edge).";
  }
  if (raw.toLowerCase().includes("network") || raw.toLowerCase().includes("fetch")) {
    return "A network problem stopped the editor from loading.";
  }
  return "Something went wrong opening the editor.";
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
  const [initializing, setInitializing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null);
  const [showLoadErrorDetail, setShowLoadErrorDetail] = useState(false);
  const [pendingFirstClip, setPendingFirstClip] = useState<VideoEditorClip | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState(initialMediaLibrary);
  const [jobs, setJobs] = useState(initialJobs);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled edit");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bigScreenBusyId, setBigScreenBusyId] = useState<string | null>(null);
  // Video duration isn't stored in the DB for Memory Wall/gallery clips
  // (see services/video-editor.ts) — measured client-side once per clip
  // via a hidden <video>'s loadedmetadata event and cached here so it's
  // only computed once even as the bin re-renders.
  const [durations, setDurations] = useState<Record<string, number>>({});
  const recordDuration = useCallback((clipId: string, seconds: number) => {
    setDurations((prev) => (prev[clipId] === seconds ? prev : { ...prev, [clipId]: seconds }));
  }, []);

  const atCap = quota ? quota.used >= quota.limit : false;
  const pendingClips = mediaLibrary.filter((c) => !c.approved);
  const approvedClips = mediaLibrary.filter((c) => c.approved);

  // Disposes the Studio SDK on unmount only — mounting happens on demand,
  // in beginEditing below, not on an effect tied to component mount. See
  // features/admin/video-editor/video-editor-client-boundary.tsx for why
  // this whole component only ever runs in the browser (next/dynamic
  // ssr:false) — Canvas/Timeline need real DOM/WebGL, which doesn't
  // exist during Next.js's server render.
  useEffect(() => {
    return () => {
      instanceRef.current?.canvas.dispose();
      instanceRef.current?.timeline.dispose();
      instanceRef.current = null;
    };
  }, []);

  // Opens the editor for the first time in this session, seeded with
  // the admin's first chosen photo/video — see buildFirstClipEdit's doc
  // comment for why the SDK is never mounted against empty content.
  // Every clip after this one goes through addClipToTimeline instead.
  async function beginEditing(clip: VideoEditorClip) {
    const timelineEl = timelineContainerRef.current;
    if (!timelineEl || initializing || instanceRef.current) return;

    setInitializing(true);
    setLoadError(null);
    setLoadErrorDetail(null);
    setPendingFirstClip(clip);

    try {
      const { edit } = buildFirstClipEdit(clip);
      const canvas = new Canvas(edit);
      await canvas.load();
      await edit.load();

      UIController.create(edit, canvas);

      const timeline = new Timeline(edit, timelineEl);
      await timeline.load();

      const controls = new Controls(edit);
      await controls.load();

      instanceRef.current = { edit, canvas, timeline, controls };
      setReady(true);

      // Canvas.load() sizes the PIXI canvas from the container's
      // getBoundingClientRect() at that exact instant. Immediately after
      // mount, the surrounding grid/flex layout can still be settling
      // (fonts, the sidebar's own content, etc.), so that first
      // measurement is sometimes smaller than the container's final
      // resting size — the SDK never re-measures on its own afterward,
      // which is what produced the "tiny video stuck in a huge navy
      // box" bug. One extra resize() a tick later, once layout has
      // definitely settled, corrects it. The ResizeObserver effect
      // below handles every resize after this one (window resize,
      // sidebar content changing height, etc.).
      requestAnimationFrame(() => instanceRef.current?.canvas.resize());
    } catch (err) {
      console.error("Video Editor: failed to load Shotstack Studio SDK:", err);
      setLoadError(describeLoadError(err));
      setLoadErrorDetail(err instanceof Error ? err.message : String(err));
    } finally {
      setInitializing(false);
    }
  }

  // Keeps the PIXI canvas's actual pixel size in sync with its
  // container's rendered size for the entire life of the editor, not
  // just once at load — covers window resizes, device rotation, and
  // the sidebar reflowing (e.g. once media finishes loading).
  useEffect(() => {
    const el = studioContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      instanceRef.current?.canvas.resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  /** Adds a clip to the end of the timeline. Only ever called once beginEditing has already created track 0 with its first clip. */
  function addClipToTimeline(clip: VideoEditorClip) {
    const instance = instanceRef.current;
    if (!instance) return;

    const length = clip.kind === "photo" ? 4 : 5;
    const start = instance.edit.totalDuration ?? 0;
    const asset = clip.kind === "photo" ? ({ type: "image", src: clip.url } as const) : ({ type: "video", src: clip.url } as const);

    instance.edit.addClip(0, { asset, start, length });
  }

  /** The media bin's tap handler — starts the editor on the first tap, adds a clip to the existing timeline on every tap after that. */
  function handleMediaTap(clip: VideoEditorClip) {
    if (instanceRef.current) {
      addClipToTimeline(clip);
    } else {
      beginEditing(clip);
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
          <p className="mt-1 text-xs text-navy-700/50">
            {ready ? "Tap a photo or video to add it to the end of the timeline." : "Tap a photo or video below to start editing."}
          </p>

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

          {/* Split pending vs. approved rather than one flat grid — a
              client with only guest-uploaded, not-yet-moderated videos
              was seeing a bin that looked entirely "Pending" with no
              visible "Approved" section at all, which read as broken.
              Two labeled sections make it clear when Approved is
              genuinely empty (nothing's been approved in Memories yet)
              versus hidden. Gallery/Timeline photos and custom uploads
              are always approved: true (see services/video-editor.ts),
              so only Memory Wall photos/videos can ever land in Pending. */}
          <MediaSection
            title="Pending Approval"
            hint="Not yet approved in Memories — visible here so you can preview and use them, but guests won't see these until you approve them."
            clips={pendingClips}
            onTap={handleMediaTap}
            disabled={initializing}
            durations={durations}
            onDuration={recordDuration}
            emptyLabel={null}
          />
          <MediaSection
            title="Approved"
            hint={null}
            clips={approvedClips}
            onTap={handleMediaTap}
            disabled={initializing}
            durations={durations}
            onDuration={recordDuration}
            emptyLabel="No approved photos or videos yet — approve some in Memories, or add Gallery photos/Timeline milestones."
          />
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

      {/* Editor canvas + timeline — capped at max-w-3xl so a wide desktop
          monitor doesn't stretch the 16:9 canvas to an oversized, mostly-empty
          box; it now stays proportional to a normal device viewport instead
          of the full grid column. */}
      <div className="order-1 mx-auto w-full max-w-3xl lg:order-2">
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
              <Button size="sm" onClick={() => pendingFirstClip && beginEditing(pendingFirstClip)}>
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
          <div className="relative overflow-hidden rounded-xl border border-navy-950/10 bg-navy-950">
            {/* This container is always in the DOM whenever there's no
                load error — beginEditing constructs Canvas/Timeline into
                it the moment the admin taps their first photo/video, so
                the ref has to already be attached before that happens.
                The "not started yet" / "starting up" messaging below is
                a sibling overlay, never a child of this div, so it never
                fights with Shotstack's own DOM writes once mounted. */}
            <div data-shotstack-studio ref={studioContainerRef} className="aspect-video w-full" />
            {!ready ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy-950/95 px-6 text-center">
                {initializing ? (
                  <>
                    <Loader2 className="animate-spin text-gold-400" size={22} />
                    <p className="text-sm text-ivory-100/80">Setting up your editor...</p>
                  </>
                ) : (
                  <>
                    <VideoIcon className="text-gold-400" size={28} />
                    <p className="text-sm font-medium text-ivory-100">Add a photo or video to get started</p>
                    <p className="text-xs text-ivory-100/60">
                      Tap anything in the Media list on the left — the editor opens as soon as you do.
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
          <div data-shotstack-timeline ref={timelineContainerRef} className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** One labeled group of media tiles (Pending or Approved) — a section is
 * always rendered (even with zero clips) so "nothing here" reads as an
 * intentional, empty state rather than a missing feature. */
function MediaSection({
  title,
  hint,
  clips,
  onTap,
  disabled,
  durations,
  onDuration,
  emptyLabel,
}: {
  title: string;
  hint: string | null;
  clips: VideoEditorClip[];
  onTap: (clip: VideoEditorClip) => void;
  disabled: boolean;
  durations: Record<string, number>;
  onDuration: (clipId: string, seconds: number) => void;
  emptyLabel: string | null;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700/60">{title}</h3>
        <span className="rounded-full bg-navy-950/8 px-1.5 py-0.5 text-[10px] font-medium text-navy-700/60">
          {clips.length}
        </span>
      </div>
      {hint ? <p className="mt-0.5 text-[11px] text-navy-700/45">{hint}</p> : null}
      <div className="mt-2 grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto">
        {clips.map((clip) => (
          <MediaTile
            key={clip.id}
            clip={clip}
            onTap={onTap}
            disabled={disabled}
            duration={durations[clip.id]}
            onDuration={onDuration}
          />
        ))}
        {clips.length === 0 && emptyLabel ? (
          <p className="col-span-2 py-6 text-center text-xs text-navy-700/50">{emptyLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

/** A single tappable tile in the media bin. Photos use their own URL as
 * the thumbnail directly. Videos have no thumbnailUrl from the backend
 * (see services/video-editor.ts) — an actual muted, preload="metadata"
 * <video> renders the first frame as a natural thumbnail without any
 * extra image-generation work, and its loadedmetadata event is also
 * how duration gets measured, since it isn't stored in the DB for
 * Memory Wall videos. */
function MediaTile({
  clip,
  onTap,
  disabled,
  duration,
  onDuration,
}: {
  clip: VideoEditorClip;
  onTap: (clip: VideoEditorClip) => void;
  disabled: boolean;
  duration: number | undefined;
  onDuration: (clipId: string, seconds: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTap(clip)}
      disabled={disabled}
      className="group relative aspect-square overflow-hidden rounded-lg border border-navy-950/10 bg-navy-950/5 disabled:cursor-not-allowed disabled:opacity-50"
      title={clip.label ?? undefined}
    >
      {clip.kind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clip.url} alt={clip.label ?? ""} className="h-full w-full object-cover" />
      ) : (
        <video
          src={clip.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            // Forces the browser to paint the first frame as the visible
            // "poster" instead of a blank/black box — most browsers only
            // decode a frame once currentTime is nudged off 0.
            el.currentTime = Math.min(0.1, el.duration || 0);
            if (Number.isFinite(el.duration)) onDuration(clip.id, el.duration);
          }}
        />
      )}
      {clip.kind === "video" && typeof duration === "number" ? (
        <span className="absolute bottom-1 right-1 rounded bg-navy-950/80 px-1 py-0.5 text-[9px] font-medium tabular-nums text-ivory-50">
          {formatDuration(duration)}
        </span>
      ) : null}
      {!clip.approved ? (
        <span className="absolute left-1 top-1 rounded-full bg-gold-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-navy-950">
          Pending
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 truncate bg-navy-950/70 px-1.5 py-0.5 text-[9px] text-ivory-50 opacity-0 group-hover:opacity-100">
        {clip.source}
      </span>
    </button>
  );
}
